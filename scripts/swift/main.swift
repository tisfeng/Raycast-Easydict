import Foundation
import ImageIO
import NaturalLanguage
import Vision

struct Payload: Encodable {
    let version = 1
    var status: String
    var text: String? = nil
    var language: String? = nil
    var confidence: Double? = nil
    var captureMs: Double = 0
    var recognitionMs: Double = 0
    var recognitionMode: String? = nil
}

struct Options {
    var mode = "accurate"
    var fixture: String? = nil
    init() throws {
        let args = Array(CommandLine.arguments.dropFirst())
        guard args.count % 2 == 0 else { throw failure("Invalid OCR arguments.") }
        for i in stride(from: 0, to: args.count, by: 2) {
            switch args[i] {
            case "--mode": mode = args[i + 1]
            case "--fixture-image": fixture = args[i + 1]
            default: throw failure("Unknown OCR argument.")
            }
        }
        guard ["fast", "accurate"].contains(mode) else { throw failure("Unknown OCR mode.") }
    }
}

func failure(_ message: String) -> NSError {
    NSError(domain: "EasydictOCR", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}
func milliseconds(_ start: Date) -> Double { Date().timeIntervalSince(start) * 1000 }
func loadImage(_ url: URL) throws -> CGImage {
    // ImageIO otherwise decodes lazily, after capture() has deleted its temporary PNG.
    let options = [kCGImageSourceShouldCacheImmediately: true] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, options) else { throw failure("Could not read the captured image.") }
    return image
}

// Fixture mode never invokes screencapture or opens the desktop pasteboard.
func capture(_ options: Options) throws -> (CGImage?, Double) {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent("easydict-ocr-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
    defer { try? FileManager.default.removeItem(at: folder) }
    let file = folder.appendingPathComponent("capture.png")
    // Exercise the same temporary-file lifetime as screenshots, without desktop access.
    if let fixture = options.fixture {
        try FileManager.default.copyItem(at: URL(fileURLWithPath: fixture), to: file)
        return (try loadImage(file), 0)
    }
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    task.arguments = ["-i", "-s", "-x", "-T0", "-t", "png", file.path]
    let errors = Pipe()
    task.standardError = errors
    let start = Date()
    try task.run()
    task.waitUntilExit()
    let message = String(data: errors.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if !FileManager.default.fileExists(atPath: file.path) {
        if message.isEmpty || message.lowercased().contains("cancel") { return (nil, milliseconds(start)) }
        throw failure(message)
    }
    guard task.terminationStatus == 0 else { throw failure(message.isEmpty ? "Screen capture failed." : message) }
    return (try loadImage(file), milliseconds(start))
}

func recognizeImage(_ image: CGImage, mode: String) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = mode == "fast" ? .fast : .accurate
    request.usesLanguageCorrection = mode == "accurate"
    // A region may contain a single small word with a large surrounding margin.
    request.minimumTextHeight = 0
    let requested = mode == "accurate"
        ? ["zh-Hans", "zh-Hant", "en-US", "ja-JP", "fr-FR", "de-DE", "es-ES", "pt-BR", "it-IT", "ko-KR", "ru-RU", "uk-UA"]
        : ["en-US"]
    let supported: [String]
    if #available(macOS 12.0, *) {
        supported = try request.supportedRecognitionLanguages()
    } else {
        supported = try VNRecognizeTextRequest.supportedRecognitionLanguages(for: request.recognitionLevel, revision: request.revision)
    }
    let languages = requested.filter { supported.contains($0) }
    request.recognitionLanguages = languages.isEmpty ? supported : languages
    if #available(macOS 13.0, *) { request.automaticallyDetectsLanguage = mode == "accurate" || languages.isEmpty }
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
}

func recognize(_ options: Options) throws -> Payload {
    let (image, captureMs) = try capture(options)
    guard let image = image else { return Payload(status: "cancelled", captureMs: captureMs) }
    let start = Date()
    var mode = options.mode
    var text = try recognizeImage(image, mode: mode)
    // Retry the same image locally; never ask for a second capture or read the clipboard.
    if text.isEmpty && mode == "fast" {
        mode = "accurate"
        text = try recognizeImage(image, mode: mode)
    }
    var result = Payload(status: text.isEmpty ? "no-text" : "recognized", text: text.isEmpty ? nil : text, captureMs: captureMs, recognitionMs: milliseconds(start), recognitionMode: mode)
    if !text.isEmpty {
        let detector = NLLanguageRecognizer()
        detector.processString(text)
        if let language = detector.dominantLanguage {
            result.language = language.rawValue
            result.confidence = detector.languageHypotheses(withMaximum: 1)[language]
        }
    }
    return result
}

do {
    let result = try recognize(Options())
    FileHandle.standardOutput.write(try JSONEncoder().encode(result))
} catch {
    fputs("\(error.localizedDescription)\n", stderr)
    exit(1)
}
