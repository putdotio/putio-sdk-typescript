import { joinCsv } from "../core/forms.js";
import { buildPutioUrl } from "../core/http.js";
import type { FileBroad } from "../domains/files.js";
import { getFileRenderType, type FileRenderTypeInput } from "./file-render-type.js";

export type FileUrlProviderInput = Pick<
  FileBroad,
  "content_type" | "extension" | "file_type" | "id" | "is_mp4_available"
>;

const normalizeApiBaseUrl = (apiURL: string): string =>
  apiURL.endsWith("/v2") ? apiURL.slice(0, -3) : apiURL;

const isVideoFile = (file: FileRenderTypeInput): boolean => getFileRenderType(file) === "video";

export class FileURLProvider {
  readonly apiURL: string;

  readonly token: string;

  readonly baseURL: string;

  constructor(apiURL: string, token: string) {
    this.baseURL = normalizeApiBaseUrl(apiURL);
    this.apiURL = `${this.baseURL}/v2`;
    this.token = token;
  }

  getDownloadURL(fileOrFileId: FileUrlProviderInput | number): string | null {
    if (typeof fileOrFileId === "number") {
      return buildPutioUrl(this.baseURL, `/v2/files/${fileOrFileId}/download`, {
        oauth_token: this.token,
      });
    }

    if (fileOrFileId.file_type === "FOLDER") {
      return null;
    }

    return buildPutioUrl(this.baseURL, `/v2/files/${fileOrFileId.id}/download`, {
      oauth_token: this.token,
    });
  }

  getHLSStreamURL(
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

    return buildPutioUrl(this.baseURL, `/v2/files/${file.id}/hls/media.m3u8`, {
      max_subtitle_count: params.maxSubtitleCount,
      oauth_token: this.token,
      original: params.playOriginal ? 1 : undefined,
      subtitle_languages: joinCsv(params.subtitleLanguages),
    });
  }

  getMP4DownloadURL(file: FileUrlProviderInput): string | null {
    if (!isVideoFile(file) || !file.is_mp4_available) {
      return null;
    }

    return buildPutioUrl(this.baseURL, `/v2/files/${file.id}/mp4/download`, {
      oauth_token: this.token,
    });
  }

  getMP4StreamURL(file: FileUrlProviderInput): string | null {
    if (!isVideoFile(file) || !file.is_mp4_available) {
      return null;
    }

    return buildPutioUrl(this.baseURL, `/v2/files/${file.id}/mp4/stream`, {
      oauth_token: this.token,
    });
  }

  getStreamURL(file: FileUrlProviderInput): string | null {
    switch (getFileRenderType(file)) {
      case "audio":
        return buildPutioUrl(this.baseURL, `/v2/files/${file.id}/stream.mp3`, {
          oauth_token: this.token,
        });
      case "video":
        return buildPutioUrl(this.baseURL, `/v2/files/${file.id}/stream`, {
          oauth_token: this.token,
        });
      default:
        return null;
    }
  }

  getXSPFURL(file: FileUrlProviderInput): string | null {
    if (!isVideoFile(file)) {
      return null;
    }

    return buildPutioUrl(this.baseURL, `/v2/files/${file.id}/xspf`, {
      oauth_token: this.token,
    });
  }
}
