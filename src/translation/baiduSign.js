/*
 * @author: tisfeng
 * @createTime: 2022-09-08 11:28
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-09-26 10:14
 * @fileName: baiduSign.js
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import CryptoJS from "crypto-js";

export const VolcengineTranslateAPI = function (words, accessKey, secretKey, toLang) {
  const Query = {
    query: {
      Action: "TranslateText",
      Version: "2020-06-01",
    },
    toString: function () {
      let queryList = [];
      for (let key of Object.keys(this.query).sort()) {
        queryList.push(`${key}=${this.query[key]}`);
      }
      return queryList.join("&");
    },
  };

  const Body = {
    body: {
      TargetLanguage: toLang,
      TextList: [words],
    },
    toString: function () {
      return JSON.stringify(this.body);
    },
  };

  const Credentials = {
    ak: accessKey,
    sk: secretKey,
    service: "translate",
    region: "cn-north-1",
  };

  function getXDate() {
    function leftPad(n) {
      return n < 10 ? "0" + n : n;
    }
    const now = new Date();
    const format = [
      now.getUTCFullYear(),
      leftPad(now.getUTCMonth() + 1),
      leftPad(now.getUTCDate()),
      "T",
      leftPad(now.getUTCHours()),
      leftPad(now.getUTCMinutes()),
      leftPad(now.getUTCSeconds()),
      "Z",
    ];
    return format.join("");
  }

  const curTime = getXDate();

  const MetaData = {
    algorithm: "HMAC-SHA256",
    service: Credentials.service,
    region: Credentials.region,
    date: curTime.substring(0, 8),
    getCredentialScope: function () {
      return `${this.date}/${this.region}/${this.service}/request`;
    },
  };

  const Header = {
    headers: {
      // 'Host': 'open.volcengineapi.com',
      "Content-Type": "application/json",
      "X-Date": curTime,
      "X-Content-Sha256": CryptoJS.SHA256(Body.toString()).toString(CryptoJS.enc.Hex),
    },
    getSignedHeaders: function () {
      let headerList = [];
      for (let key of Object.keys(this.headers).sort()) {
        headerList.push(key.toLocaleLowerCase());
      }
      return headerList.join(";");
    },
    toString: function () {
      let str = "";
      for (let key of Object.keys(this.headers).sort()) {
        str += `${key.toLocaleLowerCase()}:${this.headers[key]}\n`;
      }
      return str;
    },
  };

  const getSigningKey = function (sk, date, region, service) {
    const kdate = CryptoJS.HmacSHA256(date, sk);
    const kregion = CryptoJS.HmacSHA256(region, kdate);
    const kservice = CryptoJS.HmacSHA256(service, kregion);
    return CryptoJS.HmacSHA256("request", kservice);
  };

  const canonicalRequest = [
    "POST",
    "/",
    Query.toString(),
    Header.toString(),
    Header.getSignedHeaders(),
    Header.headers["X-Content-Sha256"],
  ].join("\n");
  const hashCanonicalRequest = CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex);
  const signing_str = [MetaData.algorithm, curTime, MetaData.getCredentialScope(), hashCanonicalRequest].join("\n");
  const signing_key = getSigningKey(Credentials.sk, MetaData.date, MetaData.region, MetaData.service);
  const sign = CryptoJS.HmacSHA256(signing_str, signing_key).toString(CryptoJS.enc.Hex);

  const Authorization = [
    `${MetaData.algorithm} Credential=${Credentials.ak}/${MetaData.getCredentialScope()}`,
    "SignedHeaders=" + Header.getSignedHeaders(),
    `Signature=${sign}`,
  ];

  Header.headers["Authorization"] = Authorization.join(", ");

  return {
    getUrl: function () {
      return "http://open.volcengineapi.com/?" + Query.toString();
    },

    getConfig: function () {
      return {
        headers: Header.headers,
      };
    },

    getParams: function () {
      return Body.body;
    },

    // handelData: function(data) {
    //     translateResult.isWord = false;
    //     // 翻译
    //     translateResult.translation = data['TranslationList'][0]['Translation'];
    //     return translateResult;
    // }
  };
};

export default function genBaiduWebSign(t) {
  var r = null;
  const window_d = "320305.131321201";

  var o,
    i = t.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g);
  if (null === i) {
    var a = t.length;
    a > 30 &&
      (t = ""
        .concat(t.substr(0, 10))
        .concat(t.substr(Math.floor(a / 2) - 5, 10))
        .concat(t.substr(-10, 10)));
  } else {
    for (var s = t.split(/[\uD800-\uDBFF][\uDC00-\uDFFF]/), c = 0, u = s.length, l = []; c < u; c++)
      "" !== s[c] &&
        l.push.apply(
          l,
          (function (t) {
            if (Array.isArray(t)) return e(t);
          })((o = s[c].split(""))) ||
            (function (t) {
              if (("undefined" != typeof Symbol && null != t[Symbol.iterator]) || null != t["@@iterator"])
                return Array.from(t);
            })(o) ||
            (function (t, n) {
              if (t) {
                if ("string" == typeof t) return e(t, n);
                var r = Object.prototype.toString.call(t).slice(8, -1);
                return (
                  "Object" === r && t.constructor && (r = t.constructor.name),
                  "Map" === r || "Set" === r
                    ? Array.from(t)
                    : "Arguments" === r || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)
                    ? e(t, n)
                    : void 0
                );
              }
            })(o) ||
            (function () {
              throw new TypeError(
                "Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."
              );
            })()
        ),
        c !== u - 1 && l.push(i[c]);
    var p = l.length;
    p > 30 &&
      (t =
        l.slice(0, 10).join("") +
        l.slice(Math.floor(p / 2) - 5, Math.floor(p / 2) + 5).join("") +
        l.slice(-10).join(""));
  }
  for (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    var d = "".concat(String.fromCharCode(103)).concat(String.fromCharCode(116)).concat(String.fromCharCode(107)),
      h = (null !== r ? r : (r = window_d || "") || "").split("."),
      f = Number(h[0]) || 0,
      m = Number(h[1]) || 0,
      g = [],
      y = 0,
      v = 0;
    v < t.length;
    v++
  ) {
    var _ = t.charCodeAt(v);
    _ < 128
      ? (g[y++] = _)
      : (_ < 2048
          ? (g[y++] = (_ >> 6) | 192)
          : (55296 == (64512 & _) && v + 1 < t.length && 56320 == (64512 & t.charCodeAt(v + 1))
              ? ((_ = 65536 + ((1023 & _) << 10) + (1023 & t.charCodeAt(++v))),
                (g[y++] = (_ >> 18) | 240),
                (g[y++] = ((_ >> 12) & 63) | 128))
              : (g[y++] = (_ >> 12) | 224),
            (g[y++] = ((_ >> 6) & 63) | 128)),
        (g[y++] = (63 & _) | 128));
  }
  for (
    var b = f,
      w =
        "".concat(String.fromCharCode(43)).concat(String.fromCharCode(45)).concat(String.fromCharCode(97)) +
        "".concat(String.fromCharCode(94)).concat(String.fromCharCode(43)).concat(String.fromCharCode(54)),
      k =
        "".concat(String.fromCharCode(43)).concat(String.fromCharCode(45)).concat(String.fromCharCode(51)) +
        "".concat(String.fromCharCode(94)).concat(String.fromCharCode(43)).concat(String.fromCharCode(98)) +
        "".concat(String.fromCharCode(43)).concat(String.fromCharCode(45)).concat(String.fromCharCode(102)),
      x = 0;
    x < g.length;
    x++
  )
    b = n((b += g[x]), w);
  return (
    (b = n(b, k)),
    (b ^= m) < 0 && (b = 2147483648 + (2147483647 & b)),
    "".concat((b %= 1e6).toString(), ".").concat(b ^ f)
  );
}

function e(t, e) {
  (null == e || e > t.length) && (e = t.length);
  for (var n = 0, r = new Array(e); n < e; n++) r[n] = t[n];
  return r;
}
function n(t, e) {
  for (var n = 0; n < e.length - 2; n += 3) {
    var r = e.charAt(n + 2);
    (r = "a" <= r ? r.charCodeAt(0) - 87 : Number(r)),
      (r = "+" === e.charAt(n + 1) ? t >>> r : t << r),
      (t = "+" === e.charAt(n) ? (t + r) & 4294967295 : t ^ r);
  }
  return t;
}
