import { describe, it, expect } from "vitest";
import {
  decodeBase64Url,
  stripHtml,
  extractMessageText,
  buildEmailText,
  emailDateStr,
  addSeenIds,
  sanitizeQuery,
  GMAIL_DEFAULT_QUERY,
} from "./gmailImport.js";

const b64url = (s) => Buffer.from(s, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("decodeBase64Url", () => {
  it("decodes url-safe base64 without padding", () => {
    expect(decodeBase64Url(b64url("Rs. 500 paid to Chai Town"))).toBe("Rs. 500 paid to Chai Town");
  });
  it("keeps non-ASCII characters intact", () => {
    expect(decodeBase64Url(b64url("रु 500 – paid"))).toBe("रु 500 – paid");
  });
  it("returns an empty string for empty input", () => {
    expect(decodeBase64Url("")).toBe("");
    expect(decodeBase64Url(undefined)).toBe("");
  });
});

describe("stripHtml", () => {
  it("removes tags, styles and entities", () => {
    expect(stripHtml("<style>p{color:red}</style><p>Paid&nbsp;Rs. 500 &amp; more</p>")).toBe("Paid Rs. 500 & more");
  });
});

describe("extractMessageText", () => {
  it("prefers text/plain over text/html", () => {
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64url("plain body") } },
        { mimeType: "text/html", body: { data: b64url("<p>html body</p>") } },
      ],
    };
    expect(extractMessageText(payload)).toBe("plain body");
  });
  it("falls back to stripped html, including nested parts", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [{ mimeType: "multipart/alternative", parts: [{ mimeType: "text/html", body: { data: b64url("<div>Rs. <b>250</b> sent</div>") } }] }],
    };
    expect(extractMessageText(payload)).toBe("Rs. 250 sent");
  });
  it("returns an empty string when there is no body", () => {
    expect(extractMessageText({ mimeType: "multipart/mixed", parts: [] })).toBe("");
  });
});

describe("buildEmailText", () => {
  it("joins subject and body", () => {
    const msg = {
      payload: {
        headers: [{ name: "subject", value: "eSewa payment" }],
        mimeType: "text/plain",
        body: { data: b64url("Rs. 500 paid to Chai Town") },
      },
    };
    expect(buildEmailText(msg)).toBe("eSewa payment. Rs. 500 paid to Chai Town");
  });
  it("uses the snippet when the payload has no body", () => {
    expect(buildEmailText({ payload: { headers: [] }, snippet: "Rs. 90 debited" })).toBe("Rs. 90 debited");
  });
});

describe("emailDateStr", () => {
  it("formats an internalDate as a local YYYY-MM-DD", () => {
    const ms = new Date(2026, 10, 21, 12, 0, 0).getTime();
    expect(emailDateStr(String(ms))).toBe("2026-11-21");
  });
  it("returns null for a missing date", () => {
    expect(emailDateStr(undefined)).toBeNull();
  });
});

describe("addSeenIds", () => {
  it("merges without duplicates", () => {
    expect(addSeenIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
  it("keeps only the newest ids when over the cap", () => {
    expect(addSeenIds(["a", "b", "c"], ["d"], 3)).toEqual(["b", "c", "d"]);
  });
});

describe("sanitizeQuery", () => {
  it("falls back to the default when blank", () => {
    expect(sanitizeQuery("   ")).toBe(GMAIL_DEFAULT_QUERY);
  });
  it("collapses extra whitespace", () => {
    expect(sanitizeQuery("from:esewa    newer_than:7d")).toBe("from:esewa newer_than:7d");
  });
});
