import { chmod, writeFile } from "node:fs/promises";

export const liveTokenCacheUrl = new URL("../.env.live-tokens", import.meta.url);

export const writeLiveTokenCache = async (
  url: URL,
  tokens: {
    readonly firstPartyToken: string;
    readonly thirdPartyToken: string;
  },
): Promise<void> => {
  const contents = [
    `PUTIO_TOKEN_FIRST_PARTY=${JSON.stringify(tokens.firstPartyToken)}`,
    `PUTIO_TOKEN_THIRD_PARTY=${JSON.stringify(tokens.thirdPartyToken)}`,
    "",
  ].join("\n");

  await writeFile(url, contents, { mode: 0o600 });
  await chmod(url, 0o600);
};
