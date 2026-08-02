export const publicContractFixtures = {
  authExchange: {
    input: {
      clientId: 321,
      clientSecret: "fixture-client-secret-not-a-credential",
      code: "fixture-authorization-code",
      redirectUri: "fixture-app://oauth/callback",
    },
    request: {
      form: {
        client_id: "321",
        client_secret: "fixture-client-secret-not-a-credential",
        code: "fixture-authorization-code",
        grant_type: "authorization_code",
        redirect_uri: "fixture-app://oauth/callback",
      },
      method: "POST",
      url: "https://api.put.io/v2/oauth2/access_token",
    },
    response: { access_token: "fixture-exchanged-token" },
    result: "fixture-exchanged-token",
  },
  fileCopy: {
    input: { fileId: 9, name: "Fixture Copy", parentId: 7 },
    request: {
      form: { file_id: "9", name: "Fixture Copy", parent_id: "7" },
      method: "POST",
      url: "https://api.put.io/v2/files/copy",
    },
    response: {
      file: {
        content_type: "video/mp4",
        created_at: "2026-08-01T00:00:00Z",
        crc32: null,
        extension: ".mp4",
        file_type: "VIDEO",
        first_accessed_at: null,
        folder_type: "REGULAR",
        icon: null,
        id: 10,
        is_hidden: false,
        is_mp4_available: true,
        is_shared: false,
        name: "Fixture Copy",
        opensubtitles_hash: null,
        parent_id: 7,
        screenshot: null,
        size: 1024,
        updated_at: "2026-08-01T00:00:00Z",
      },
      status: "OK",
    },
  },
  podcastLinks: {
    input: { parentId: 42, types: ["all", "mp4"] as const },
    request: {
      method: "GET",
      url: "https://api.put.io/v2/podcast/links?parent_id=42&type=all%2Cmp4",
    },
    response: {
      links: {
        all: "https://api.put.io/v2/podcast/feed/all",
        mp4: "https://api.put.io/v2/podcast/feed/mp4",
      },
      status: "OK",
      token: "fixture-podcast-token",
    },
    result: {
      links: {
        all: "https://api.put.io/v2/podcast/feed/all",
        mp4: "https://api.put.io/v2/podcast/feed/mp4",
      },
      token: "fixture-podcast-token",
    },
  },
  transferTorrent: {
    input: 11,
    request: {
      method: "GET",
      url: "https://api.put.io/v2/transfers/11/torrent",
    },
    responseBytes: [100, 56, 58],
  },
} as const;
