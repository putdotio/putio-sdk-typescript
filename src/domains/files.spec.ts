import { PutioConfigurationError, PutioValidationError } from "../core/errors.js";
import { describe, expect, it } from "vitest";

import * as files from "./files.js";
import {
  emptyResponse,
  expectFailure,
  getFormBody,
  getFormDataBody,
  jsonResponse,
  runConfigEffect,
  runConfigExit,
  runSdkEffect,
  runSdkExit,
} from "../../test/support/sdk-test.js";

const baseFile = {
  content_type: "video/mp4",
  created_at: "2026-03-17T00:00:00Z",
  crc32: null,
  extension: ".mp4",
  file_type: "VIDEO" as const,
  first_accessed_at: null,
  folder_type: "REGULAR" as const,
  icon: null,
  id: 9,
  is_hidden: false,
  is_mp4_available: true,
  is_shared: false,
  name: "SDK File",
  opensubtitles_hash: null,
  parent_id: 0,
  screenshot: null,
  size: 1024,
  updated_at: "2026-03-17T00:00:00Z",
};

describe("files domain", () => {
  it("builds direct access URLs and config-backed helpers", async () => {
    expect(
      files.buildFileApiDownloadUrl("https://api.put.io", 42, {
        name: "hello world.mp4",
        oauthToken: "token-123",
        useTunnel: false,
      }),
    ).toBe(
      "https://api.put.io/v2/files/42/download/hello%20world.mp4?notunnel=1&oauth_token=token-123",
    );

    expect(
      files.buildFileApiContentUrl("https://api.put.io", 42, {
        oauthToken: "token-123",
      }),
    ).toBe("https://api.put.io/v2/files/42/stream?oauth_token=token-123");

    expect(
      files.buildFileApiMp4DownloadUrl("https://api.put.io", 42, {
        convert: true,
        name: "hello world.mp4",
        oauthToken: "token-123",
        useTunnel: false,
      }),
    ).toBe(
      "https://api.put.io/v2/files/42/mp4/download/hello%20world.mp4?notunnel=1&convert=1&oauth_token=token-123",
    );

    expect(
      files.buildFileHlsStreamUrl("https://api.put.io", 42, {
        maxSubtitleCount: 2,
        oauthToken: "token-123",
        playOriginal: false,
        subtitleLanguages: ["en", "tr"],
      }),
    ).toBe(
      "https://api.put.io/v2/files/42/hls/media.m3u8?max_subtitle_count=2&oauth_token=token-123&original=0&subtitle_languages=en%2Ctr",
    );

    expect(
      await runConfigEffect(files.getApiDownloadUrl(42), {
        accessToken: "token-123",
        baseUrl: "https://api.put.io",
      }),
    ).toBe("https://api.put.io/v2/files/42/download?oauth_token=token-123");

    expect(
      await runConfigEffect(
        files.getApiContentUrl(42, {
          useTunnel: false,
        }),
        {
          accessToken: "token-123",
          baseUrl: "https://api.put.io",
        },
      ),
    ).toBe("https://api.put.io/v2/files/42/stream?notunnel=1&oauth_token=token-123");

    expect(
      await runConfigEffect(
        files.getApiMp4DownloadUrl(42, {
          convert: true,
        }),
        {
          accessToken: "token-123",
          baseUrl: "https://api.put.io",
        },
      ),
    ).toBe("https://api.put.io/v2/files/42/mp4/download?convert=1&oauth_token=token-123");

    expect(
      await runConfigEffect(files.getHlsStreamUrl(42), {
        accessToken: "token-123",
        baseUrl: "https://api.put.io",
      }),
    ).toBe("https://api.put.io/v2/files/42/hls/media.m3u8?oauth_token=token-123");

    const uploadRequest = await runConfigEffect(
      files.createFileUploadRequest({
        file: new Blob(["hello"], { type: "text/plain" }),
        fileName: "hello.txt",
        parentId: 7,
      }),
      {
        accessToken: "token-123",
        uploadBaseUrl: "https://upload.put.io",
      },
    );

    expect(uploadRequest.method).toBe("POST");
    expect(uploadRequest.url).toBe("https://upload.put.io/v2/files/upload?oauth_token=token-123");
    expect(uploadRequest.body.get("filename")).toBe("hello.txt");
    expect(uploadRequest.body.get("parent_id")).toBe("7");

    const missingTokenExit = await runConfigExit(files.getApiDownloadUrl(42));
    const missingTokenError = expectFailure(missingTokenExit);
    expect(missingTokenError).toBeInstanceOf(PutioConfigurationError);
  });

  it("covers file reads, searches, and requested-field validation", async () => {
    expect(
      await runSdkEffect(
        files.getFile({
          id: 9,
        }),
        () =>
          jsonResponse({
            file: baseFile,
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ id: 9 });

    const file = await runSdkEffect(
      files.getFile({
        id: 9,
        query: {
          codecs: 1,
          media_info: 1,
          mp4_status: 1,
          mp4_stream_url: 1,
          stream_url: 1,
          video_metadata: 1,
        },
      }),
      (request) => {
        expect(request.url).toBe(
          "https://api.put.io/v2/files/9?codecs=1&media_info=1&mp4_status=1&mp4_stream_url=1&stream_url=1&video_metadata=1",
        );

        return jsonResponse({
          file: {
            ...baseFile,
            content_type_and_codecs: "video/mp4; codecs=avc1",
            media_info: {
              format: {
                bit_rate: 1000,
                duration: 20,
                name: "mp4",
              },
              mime_type: "video/mp4",
              streams: [{ codec_name: "h264", codec_type: "video", height: 720, width: 1280 }],
            },
            mp4_size: 2048,
            mp4_stream_url: "https://api.put.io/mp4.m3u8",
            need_convert: false,
            stream_url: "https://api.put.io/stream.m3u8",
            video_metadata: {
              aspect_ratio: 1.77,
              duration: 20,
              height: 720,
              width: 1280,
            },
          },
          status: "OK",
        });
      },
      { accessToken: "token-123" },
    );

    expect(file.stream_url).toBe("https://api.put.io/stream.m3u8");
    expect(file.mp4_stream_url).toBe("https://api.put.io/mp4.m3u8");
    expect(file.content_type_and_codecs).toContain("codecs");
    expect(file.media_info?.mime_type).toBe("video/mp4");
    expect(file.video_metadata?.width).toBe(1280);

    const validationExit = await runSdkExit(
      files.getFile({
        id: 9,
        query: {
          stream_url: 1,
        },
      }),
      () =>
        jsonResponse({
          file: baseFile,
          status: "OK",
        }),
      { accessToken: "token-123" },
    );

    const validationError = expectFailure(validationExit);
    expect(validationError).toBeInstanceOf(PutioValidationError);
    expect(validationError).toMatchObject({
      _tag: "PutioValidationError",
      cause: 'Expected put.io to include "stream_url" because it was requested',
    });

    for (const [query, expectedCause] of [
      [
        { media_metadata: 1 },
        'Expected put.io to include "media_metadata" because it was requested',
      ],
      [
        { codecs: 1 },
        'Expected put.io to include "content_type_and_codecs" because it was requested',
      ],
      [{ media_info: 1 }, 'Expected put.io to include "media_info" because it was requested'],
    ] as const) {
      const missingExit = await runSdkExit(
        files.getFile({
          id: 9,
          query,
        }),
        () =>
          jsonResponse({
            file: baseFile,
            status: "OK",
          }),
        { accessToken: "token-123" },
      );

      expect(expectFailure(missingExit)).toMatchObject({
        _tag: "PutioValidationError",
        cause: expectedCause,
      });
    }

    const listResponse = await runSdkEffect(
      files.queryFiles(5, {
        per_page: 2,
        sort_by: "NAME_ASC",
      }),
      (request) => {
        expect(request.url).toBe(
          "https://api.put.io/v2/files/list?per_page=2&sort_by=NAME_ASC&parent_id=5",
        );

        return jsonResponse({
          breadcrumbs: [[0, "Root"]],
          cursor: "cursor-1",
          files: [baseFile],
          parent: baseFile,
          status: "OK",
          total: 1,
        });
      },
      { accessToken: "token-123" },
    );

    expect(listResponse.files).toHaveLength(1);

    const sharedWithYou = await runSdkEffect(
      files.queryFiles("friends", { total: 1 }),
      (request) => {
        expect(request.url).toBe("https://api.put.io/v2/files/list/items-shared-with-you?total=1");

        return jsonResponse({
          cursor: null,
          files: [baseFile],
          parent: null,
          status: "OK",
          total: 1,
        });
      },
      { accessToken: "token-123" },
    );

    expect(sharedWithYou.total).toBe(1);

    expect(
      await runSdkEffect(
        files.continueFiles("cursor-1", { per_page: 3 }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/files/list/continue?per_page=3");
          expect(getFormBody(request).get("cursor")).toBe("cursor-1");

          return jsonResponse({
            cursor: null,
            files: [baseFile],
            parent: baseFile,
            status: "OK",
            total: 1,
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ files: [expect.objectContaining({ id: 9 })] });

    expect(
      await runSdkEffect(
        files.searchFiles({
          query: "sdk",
          type: ["VIDEO", "AUDIO"],
        }),
        (request) => {
          expect(request.url).toBe(
            "https://api.put.io/v2/files/search?query=sdk&type=VIDEO%2CAUDIO",
          );

          return jsonResponse({
            cursor: "cursor-2",
            files: [baseFile],
            status: "OK",
            total: 1,
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ total: 1 });

    expect(
      await runSdkEffect(
        files.continueSearch("cursor-2", { per_page: 5 }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/files/search/continue?per_page=5");
          expect(getFormBody(request).get("cursor")).toBe("cursor-2");

          return jsonResponse({
            cursor: null,
            files: [baseFile],
            status: "OK",
            total: 1,
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ files: [expect.objectContaining({ id: 9 })] });
  });

  it("covers file mutation endpoints and bulk helpers", async () => {
    expect(
      await runSdkEffect(
        files.createFolder({
          name: "SDK",
          parent_id: 5,
        }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("name")).toBe("SDK");
          expect(body.get("parent_id")).toBe("5");

          return jsonResponse({
            file: {
              ...baseFile,
              file_type: "FOLDER",
              id: 10,
              name: "SDK",
            },
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ id: 10, name: "SDK" });

    expect(
      await runSdkEffect(
        files.renameFile({
          file_id: 9,
          name: "Renamed",
        }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("file_id")).toBe("9");
          expect(body.get("name")).toBe("Renamed");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
        files.deleteFiles([9, 10], {
          ignoreFileOwner: true,
          partialDelete: true,
          skipTrash: true,
        }),
        (request) => {
          expect(request.url).toBe(
            "https://api.put.io/v2/files/delete?partial_delete=true&skip_nonexistents=true&skip_owner_check=true&skip_trash=true",
          );
          expect(getFormBody(request).get("file_ids")).toBe("9,10");

          return jsonResponse({
            cursor: null,
            skipped: 0,
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ skipped: 0 });

    expect(
      await runSdkEffect(
        files.deleteFileSelection(
          {
            cursor: "cursor-1",
            excludeIds: [11],
          },
          {
            partialDelete: true,
          },
        ),
        (request) => {
          expect(request.url).toBe(
            "https://api.put.io/v2/files/delete?partial_delete=true&skip_nonexistents=true",
          );
          const body = getFormBody(request);
          expect(body.get("cursor")).toBe("cursor-1");
          expect(body.get("exclude_ids")).toBe("11");

          return jsonResponse({
            cursor: null,
            skipped: 1,
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ skipped: 1 });

    expect(
      await runSdkEffect(
        files.moveFiles([9, 10], 7),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("file_ids")).toBe("9,10");
          expect(body.get("parent_id")).toBe("7");

          return jsonResponse({
            errors: [],
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual([]);

    expect(
      await runSdkEffect(
        files.moveFileSelection(
          {
            cursor: "cursor-1",
            ids: [9],
          },
          7,
        ),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("cursor")).toBe("cursor-1");
          expect(body.get("file_ids")).toBe("9");
          expect(body.get("parent_id")).toBe("7");

          return jsonResponse({
            errors: [],
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual([]);
  });

  it("covers playback, subtitle, conversion, extraction, and next-file helpers", async () => {
    expect(
      await runSdkEffect(
        files.getStartFrom(9),
        () => jsonResponse({ start_from: 42, status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toBe(42);

    expect(
      await runSdkEffect(
        files.getDownloadUrl(9),
        () => jsonResponse({ status: "OK", url: "https://download.put.io/file" }),
        { accessToken: "token-123" },
      ),
    ).toBe("https://download.put.io/file");

    expect(
      await runSdkEffect(
        files.listFileSubtitles(9, {
          languages: ["en", "tr"],
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/files/9/subtitles?languages=en%2Ctr");

          return jsonResponse({
            default: "en",
            subtitles: [
              {
                format: "srt",
                key: "sub-1",
                language: "English",
                language_code: "en",
                name: "English",
                source: "opensubtitles",
                url: "https://api.put.io/subtitles/1",
              },
            ],
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ default: "en", subtitles: [expect.any(Object)] });

    expect(
      await runSdkEffect(
        files.setStartFrom({
          file_id: 9,
          time: 12.5,
        }),
        (request) => {
          expect(getFormBody(request).get("time")).toBe("12.5");
          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(files.resetStartFrom(9), () => jsonResponse({ status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
        files.getMp4Status(9),
        () =>
          jsonResponse({ mp4: { id: 9, percent_done: 25, status: "CONVERTING" }, status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ status: "CONVERTING" });

    expect(
      await runSdkEffect(
        files.convertFileToMp4(9),
        () => jsonResponse({ mp4: { id: 9, status: "NOT_AVAILABLE" }, status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ status: "NOT_AVAILABLE" });

    await runSdkEffect(files.deleteFileMp4(9), () => emptyResponse({ status: 200 }), {
      accessToken: "token-123",
    });

    await runSdkEffect(files.putMp4ToMyFiles(9), () => emptyResponse({ status: 200 }), {
      accessToken: "token-123",
    });

    expect(
      await runSdkEffect(
        files.convertFilesToMp4([9, 10]),
        (request) => {
          expect(getFormBody(request).get("file_ids")).toBe("9,10");
          return jsonResponse({ count: 2, status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe(2);

    expect(
      await runSdkEffect(
        files.convertFileSelectionToMp4({
          cursor: "cursor-1",
          ids: [9],
        }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("cursor")).toBe("cursor-1");
          expect(body.get("file_ids")).toBe("9");

          return jsonResponse({ count: 1, status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe(1);

    expect(
      await runSdkEffect(
        files.listActiveMp4Conversions(),
        () =>
          jsonResponse({
            mp4s: [{ id: 9, name: "SDK File", percent_done: 50, status: "CONVERTING" }],
          }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    await runSdkEffect(
      files.setFilesWatchStatus({
        cursor: "cursor-1",
        ids: [9],
        watched: true,
      }),
      (request) => {
        const body = getFormBody(request);
        expect(body.get("cursor")).toBe("cursor-1");
        expect(body.get("file_ids")).toBe("9");
        expect(body.get("watched")).toBe("true");
        return emptyResponse({ status: 200 });
      },
      { accessToken: "token-123" },
    );

    expect(
      await runSdkEffect(
        files.extractFiles({
          ids: [9],
          password: "secret",
        }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("user_file_ids")).toBe("9");
          expect(body.get("password")).toBe("secret");

          return jsonResponse({
            extractions: [
              {
                files: [9],
                id: 1,
                message: null,
                name: "SDK Archive",
                num_parts: 1,
                status: "NEW",
              },
            ],
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(
        files.listFileExtractions(),
        () =>
          jsonResponse({
            extractions: [
              {
                files: [9],
                id: 1,
                message: null,
                name: "SDK Archive",
                num_parts: 1,
                status: "EXTRACTING",
              },
            ],
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    await runSdkEffect(files.deleteFileExtraction(1), () => emptyResponse({ status: 200 }), {
      accessToken: "token-123",
    });

    expect(
      await runSdkEffect(
        files.findNextFile(9, "VIDEO"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/files/9/next-file?file_type=VIDEO");

          return jsonResponse({
            next_file: { id: 10, name: "Next", parent_id: 0 },
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ id: 10 });

    expect(
      await runSdkEffect(
        files.findNextVideo(9),
        () =>
          jsonResponse({
            next_video: { id: 11, name: "Next Video", parent_id: 0 },
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ id: 11 });
  });

  it("covers upload helpers and upload result validation", async () => {
    const uploadFormData = files.createFileUploadFormData({
      file: new Blob(["hello"], { type: "text/plain" }),
      fileName: "hello.txt",
      parentId: 7,
    });

    expect(uploadFormData.get("filename")).toBe("hello.txt");
    expect(uploadFormData.get("parent_id")).toBe("7");

    expect(
      await runSdkEffect(
        files.uploadFile({
          file: new Blob(["hello"], { type: "text/plain" }),
          fileName: "hello.txt",
          parentId: 7,
        }),
        (request) => {
          const body = getFormDataBody(request);
          expect(request.url).toBe("https://upload.put.io/v2/files/upload?oauth_token=token-123");
          expect(body.get("filename")).toBe("hello.txt");
          expect(body.get("parent_id")).toBe("7");

          return jsonResponse({
            file: baseFile,
            status: "OK",
          });
        },
        {
          accessToken: "token-123",
          uploadBaseUrl: "https://upload.put.io",
        },
      ),
    ).toEqual({
      file: baseFile,
      type: "file",
    });

    expect(
      await runSdkEffect(
        files.uploadFile(
          {
            file: new Blob(["hello"], { type: "text/plain" }),
          },
          {
            oauthToken: "override-token",
          },
        ),
        (request) => {
          expect(request.url).toBe(
            "https://upload.put.io/v2/files/upload?oauth_token=override-token",
          );

          return jsonResponse({
            status: "OK",
            transfer: {
              id: 12,
              name: "Queued Upload",
            },
          });
        },
        {
          accessToken: "token-123",
          uploadBaseUrl: "https://upload.put.io",
        },
      ),
    ).toEqual({
      transfer: {
        id: 12,
        name: "Queued Upload",
      },
      type: "transfer",
    });

    await expect(
      runSdkEffect(
        files.uploadFile({
          file: new Blob(["hello"], { type: "text/plain" }),
        }),
        () =>
          jsonResponse({
            status: "OK",
          }),
        {
          accessToken: "token-123",
          uploadBaseUrl: "https://upload.put.io",
        },
      ),
    ).rejects.toBeTruthy();
  });
});
