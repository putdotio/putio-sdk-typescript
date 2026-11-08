import { Predicate, Result, Schema } from "effect";

import { mapDecodeErrorToValidationError } from "../core/errors.js";
import { joinCsv } from "../core/forms.js";
import { buildPutioUrl, encodePathSegment, type PutioQuery } from "../core/http.js";
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

  #fileUrl(
    fileId: number,
    resource: string,
    query: PutioQuery = { oauth_token: this.downloadToken },
  ): string {
    return buildPutioUrl(this.baseUrl, `/v2/files/${encodePathSegment(fileId)}/${resource}`, query);
  }

  getDownloadUrl(fileOrFileId: FileUrlProviderInput | number): string | null {
    if (Predicate.isNumber(fileOrFileId)) {
      return this.#fileUrl(fileOrFileId, "download");
    }

    return fileOrFileId.file_type === "FOLDER" ? null : this.#fileUrl(fileOrFileId.id, "download");
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

    return this.#fileUrl(file.id, "hls/media.m3u8", {
      max_subtitle_count: params.maxSubtitleCount,
      oauth_token: this.downloadToken,
      original: params.playOriginal ? 1 : undefined,
      subtitle_languages: joinCsv(params.subtitleLanguages),
    });
  }

  getMp4DownloadUrl(file: FileUrlProviderInput): string | null {
    return isVideoFile(file) && file.is_mp4_available
      ? this.#fileUrl(file.id, "mp4/download")
      : null;
  }

  getMp4StreamUrl(file: FileUrlProviderInput): string | null {
    return isVideoFile(file) && file.is_mp4_available ? this.#fileUrl(file.id, "mp4/stream") : null;
  }

  getStreamUrl(file: FileUrlProviderInput): string | null {
    switch (getFileRenderType(file)) {
      case "audio":
        return this.#fileUrl(file.id, "stream.mp3");
      case "video":
        return this.#fileUrl(file.id, "stream");
      default:
        return null;
    }
  }

  getXspfUrl(file: FileUrlProviderInput): string | null {
    return isVideoFile(file) ? this.#fileUrl(file.id, "xspf") : null;
  }
}
