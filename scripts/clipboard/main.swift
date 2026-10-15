import AppKit
import Foundation

struct Payload: Encodable {
    let kind: String
    var text: String? = nil
    var data: String? = nil
}
let maxBytes = 10 * 1024 * 1024
func imagePayload(_ data: Data) throws -> Payload {
    guard data.count <= 64 * 1024 * 1024, let image = NSBitmapImageRep(data: data),
          let png = image.representation(using: .png, properties: [:]), png.count <= maxBytes else {
        throw NSError(domain: "CaptureClipboard", code: 1, userInfo: [NSLocalizedDescriptionKey: "Image is unreadable or larger than 10 MB."])
    }
    return Payload(kind: "image", data: png.base64EncodedString())
}
func readPayload() throws -> Payload {
    // Fixture mode exercises conversion without opening the system pasteboard.
    if CommandLine.arguments.count == 3 && CommandLine.arguments[1] == "--fixture-image" {
        return try imagePayload(Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2])))
    }
    guard CommandLine.arguments.count == 1 else {
        throw NSError(domain: "CaptureClipboard", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unexpected arguments."])
    }
    let pasteboard = NSPasteboard.general
    for type in [NSPasteboard.PasteboardType.png, .tiff, NSPasteboard.PasteboardType("public.jpeg")] {
        if let data = pasteboard.data(forType: type) { return try imagePayload(data) }
    }
    if let raw = pasteboard.string(forType: .fileURL), let url = URL(string: raw), url.isFileURL,
       ["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff"].contains(url.pathExtension.lowercased()) {
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= maxBytes else { throw NSError(domain: "CaptureClipboard", code: 3, userInfo: [NSLocalizedDescriptionKey: "Image exceeds 10 MB."]) }
        return try imagePayload(Data(contentsOf: url))
    }
    if let text = pasteboard.string(forType: .string), !text.isEmpty { return Payload(kind: "text", text: text) }
    return Payload(kind: "empty")
}
do {
    let output = try JSONEncoder().encode(readPayload())
    FileHandle.standardOutput.write(output)
} catch {
    fputs("\(error.localizedDescription)\n", stderr)
    exit(1)
}
