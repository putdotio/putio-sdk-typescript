import { describe, expect, it } from "vitest";

import { getFileRenderType } from "./file-render-type.js";
import { toHumanFileSize } from "./file-size.js";
import { FileURLProvider } from "./file-url-provider.js";

const baseFile = {
  content_type: "unknown",
  extension: "txt",
  file_type: "FILE" as const,
  id: 1,
  is_mp4_available: false,
};

describe("utility file", () => {
  it("derives render types", () => {
    expect(
      getFileRenderType({
        ...baseFile,
        content_type: null,
      }),
    ).toBe("other");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "application/x-directory",
        file_type: "FOLDER",
      }),
    ).toBe("folder");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "audio/mpeg",
        file_type: "AUDIO",
      }),
    ).toBe("audio");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
      }),
    ).toBe("video");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "image/png",
      }),
    ).toBe("image");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "application/pdf",
      }),
    ).toBe("pdf");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "application/epub+zip",
      }),
    ).toBe("epub");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "application/zip",
      }),
    ).toBe("archive");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "text/plain",
        file_type: "TEXT",
      }),
    ).toBe("text");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "text/markdown",
        extension: "md",
        file_type: "TEXT",
      }),
    ).toBe("text/markdown");

    expect(
      getFileRenderType({
        ...baseFile,
        content_type: "application/octet-stream",
      }),
    ).toBe("other");
  });

  it("formats human file sizes", () => {
    expect(toHumanFileSize(1024)).toBe("1 KB");
    expect(toHumanFileSize(1024, { unitSeparator: "-" })).toBe("1-KB");
    expect(toHumanFileSize("1024")).toBe("1 KB");
  });

  it("builds file access urls", () => {
    const provider = new FileURLProvider("https://api.example.com", "test-token");
    const providerWithVersionedUrl = new FileURLProvider(
      "https://api.example.com/v2",
      "test-token",
    );
    expect(provider.apiURL).toBe("https://api.example.com/v2");
    expect(providerWithVersionedUrl.baseURL).toBe("https://api.example.com");
    expect(provider.getDownloadURL(123)).toBe(
      "https://api.example.com/v2/files/123/download?oauth_token=test-token",
    );
    expect(provider.getDownloadURL({ ...baseFile, file_type: "FOLDER" })).toBeNull();
    expect(provider.getDownloadURL({ ...baseFile, file_type: "VIDEO" })).toBe(
      "https://api.example.com/v2/files/1/download?oauth_token=test-token",
    );
    expect(
      provider.getHLSStreamURL(
        {
          ...baseFile,
          content_type: "video/mp4",
          file_type: "VIDEO",
        },
        {
          maxSubtitleCount: 2,
          playOriginal: true,
          subtitleLanguages: ["en", "es"],
        },
      ),
    ).toBe(
      "https://api.example.com/v2/files/1/hls/media.m3u8?max_subtitle_count=2&oauth_token=test-token&original=1&subtitle_languages=en%2Ces",
    );
    expect(
      provider.getHLSStreamURL({
        ...baseFile,
        content_type: "audio/mpeg",
        file_type: "AUDIO",
      }),
    ).toBeNull();
    expect(
      provider.getMP4DownloadURL({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
        is_mp4_available: true,
      }),
    ).toBe("https://api.example.com/v2/files/1/mp4/download?oauth_token=test-token");
    expect(
      provider.getMP4DownloadURL({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
        is_mp4_available: false,
      }),
    ).toBeNull();
    expect(
      provider.getMP4StreamURL({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
        is_mp4_available: true,
      }),
    ).toBe("https://api.example.com/v2/files/1/mp4/stream?oauth_token=test-token");
    expect(
      provider.getMP4StreamURL({
        ...baseFile,
        content_type: "audio/mpeg",
        file_type: "AUDIO",
      }),
    ).toBeNull();
    expect(
      provider.getStreamURL({
        ...baseFile,
        content_type: "audio/mpeg",
        file_type: "AUDIO",
      }),
    ).toBe("https://api.example.com/v2/files/1/stream.mp3?oauth_token=test-token");
    expect(
      provider.getStreamURL({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
      }),
    ).toBe("https://api.example.com/v2/files/1/stream?oauth_token=test-token");
    expect(provider.getStreamURL(baseFile)).toBeNull();
    expect(
      provider.getXSPFURL({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
      }),
    ).toBe("https://api.example.com/v2/files/1/xspf?oauth_token=test-token");
    expect(provider.getXSPFURL(baseFile)).toBeNull();
  });
});
