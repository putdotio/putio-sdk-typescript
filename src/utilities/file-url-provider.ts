import { Result, Schema } from "effect";

import { mapDecodeErrorToValidationError } from "../core/errors.js";
import { joinCsv } from "../core/forms.js";
import { buildPutioUrl, encodePathSegment } from "../core/http.js";
import type { FileBroad } from "../domains/files.js";
import { NonEmptyStringSchema } from "../core/validation.js";
import { getFileRenderType, type FileRenderTypeInput } from "./file-render-type.js";

export type FileUrlProviderInput = Pick<
  FileBroad,
  "content_type" | "extension" | "file_type" | "id" | "is_mp4_available"
>;

const FileUrlProviderOptionsSchema = Schema.Struct({
  baseUrl: NonEmptyStringSchema,
  downloadToken: NonEmptyStringSchema,
});

export type FileUrlProviderOptions = {
  /** The put.io API origin, with or without the trailing `/v2`. */
  readonly baseUrl: string;
  /** The account download token from `getAccountInfo({ download_token: 1 })`, not the OAuth token. */
  readonly downloadToken: string;
};

const decodeOptions = (options: FileUrlProviderOptions): FileUrlProviderOptions => {
  const decoded = Schema.decodeUnknownResult(FileUrlProviderOptionsSchema, {
    onExcessProperty: "error",
  })(options);
  if (Result.isFailure(decoded)) {
    throw mapDecodeErrorToValidationError(decoded.failure);
  }
  return decoded.success;
};

const normalizeApiBaseUrl = (apiUrl: string): string =>
  apiUrl.endsWith("/v2") ? apiUrl.slice(0, -3) : apiUrl;

const isVideoFile = (file: FileRenderTypeInput): boolean => getFileRenderType(file) === "video";

export class FileUrlProvider {
  readonly apiUrl: string;

  /** The account download token from `getAccountInfo({ download_token: 1 })`, not the OAuth token. */
  readonly downloadToken: string;

  readonly baseUrl: string;

  constructor(options: FileUrlProviderOptions) {
    const { baseUrl, downloadToken } = decodeOptions(options);
    this.baseUrl = normalizeApiBaseUrl(baseUrl);
    this.apiUrl = `${this.baseUrl}/v2`;
    this.downloadToken = downloadToken;
  }

  getDownloadUrl(fileOrFileId: FileUrlProviderInput | number): string | null {
    if (typeof fileOrFileId === "number") {
      return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(fileOrFileId)}/download`, {
        oauth_token: this.downloadToken,
      });
    }

    if (fileOrFileId.file_type === "FOLDER") {
      return null;
    }

    return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(fileOrFileId.id)}/download`, {
      oauth_token: this.downloadToken,
    });
  }

  getHlsStreamUrl(
    file: FileUrlProviderInput,
    params: {
      readonly maxSubtitleCount?: number;
      readonly playOriginal?: boolean;
      readonly subtitleLanguages?: ReadonlyArray<string>;
    } = {},
  ): string | null {
    if (!isVideoFile(file)) {
      return null;
    }

    return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(file.id)}/hls/media.m3u8`, {
      max_subtitle_count: params.maxSubtitleCount,
      oauth_token: this.downloadToken,
      original: params.playOriginal ? 1 : undefined,
      subtitle_languages: joinCsv(params.subtitleLanguages),
    });
  }

  getMp4DownloadUrl(file: FileUrlProviderInput): string | null {
    if (!isVideoFile(file) || !file.is_mp4_available) {
      return null;
    }

    return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(file.id)}/mp4/download`, {
      oauth_token: this.downloadToken,
    });
  }

  getMp4StreamUrl(file: FileUrlProviderInput): string | null {
    if (!isVideoFile(file) || !file.is_mp4_available) {
      return null;
    }

    return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(file.id)}/mp4/stream`, {
      oauth_token: this.downloadToken,
    });
  }

  getStreamUrl(file: FileUrlProviderInput): string | null {
    switch (getFileRenderType(file)) {
      case "audio":
        return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(file.id)}/stream.mp3`, {
          oauth_token: this.downloadToken,
        });
      case "video":
        return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(file.id)}/stream`, {
          oauth_token: this.downloadToken,
        });
      default:
        return null;
    }
  }

  getXspfUrl(file: FileUrlProviderInput): string | null {
    if (!isVideoFile(file)) {
      return null;
    }

    return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(file.id)}/xspf`, {
      oauth_token: this.downloadToken,
    });
  }
}
