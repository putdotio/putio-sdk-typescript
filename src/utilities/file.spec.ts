import { PutioValidationError } from "../core/errors.js";
import { describe, expect, it } from "vite-plus/test";

import { getFileRenderType } from "./file-render-type.js";
import { toHumanFileSize } from "./file-size.js";
import { FileUrlProvider } from "./file-url-provider.js";

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
    const provider = new FileUrlProvider({
      baseUrl: "https://api.example.com",
      downloadToken: "test-token",
    });
    const providerWithVersionedUrl = new FileUrlProvider({
      baseUrl: "https://api.example.com/v2",
      downloadToken: "test-token",
    });
    expect(provider.apiUrl).toBe("https://api.example.com/v2");
    expect(provider.downloadToken).toBe("test-token");
    expect(
      () => new FileUrlProvider({ baseUrl: "https://api.example.com", downloadToken: "" }),
    ).toThrow(PutioValidationError);
    expect(
      // @ts-expect-error JavaScript callers can omit the download token.
      () => new FileUrlProvider({ baseUrl: "https://api.example.com" }),
    ).toThrow(PutioValidationError);
    expect(providerWithVersionedUrl.baseUrl).toBe("https://api.example.com");
    expect(provider.getDownloadUrl(123)).toBe(
      "https://api.example.com/v2/files/123/download?oauth_token=test-token",
    );
    expect(provider.getDownloadUrl({ ...baseFile, file_type: "FOLDER" })).toBeNull();
    expect(provider.getDownloadUrl({ ...baseFile, file_type: "VIDEO" })).toBe(
      "https://api.example.com/v2/files/1/download?oauth_token=test-token",
    );
    expect(
      provider.getHlsStreamUrl(
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
      provider.getHlsStreamUrl({
        ...baseFile,
        content_type: "audio/mpeg",
        file_type: "AUDIO",
      }),
    ).toBeNull();
    expect(
      provider.getMp4DownloadUrl({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
        is_mp4_available: true,
      }),
    ).toBe("https://api.example.com/v2/files/1/mp4/download?oauth_token=test-token");
    expect(
      provider.getMp4DownloadUrl({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
        is_mp4_available: false,
      }),
    ).toBeNull();
    expect(
      provider.getMp4StreamUrl({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
        is_mp4_available: true,
      }),
    ).toBe("https://api.example.com/v2/files/1/mp4/stream?oauth_token=test-token");
    expect(
      provider.getMp4StreamUrl({
        ...baseFile,
        content_type: "audio/mpeg",
        file_type: "AUDIO",
      }),
    ).toBeNull();
    expect(
      provider.getStreamUrl({
        ...baseFile,
        content_type: "audio/mpeg",
        file_type: "AUDIO",
      }),
    ).toBe("https://api.example.com/v2/files/1/stream.mp3?oauth_token=test-token");
    expect(
      provider.getStreamUrl({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
      }),
    ).toBe("https://api.example.com/v2/files/1/stream?oauth_token=test-token");
    expect(provider.getStreamUrl(baseFile)).toBeNull();
    expect(
      provider.getXspfUrl({
        ...baseFile,
        content_type: "video/mp4",
        file_type: "VIDEO",
      }),
    ).toBe("https://api.example.com/v2/files/1/xspf?oauth_token=test-token");
    expect(provider.getXspfUrl(baseFile)).toBeNull();
  });
});
