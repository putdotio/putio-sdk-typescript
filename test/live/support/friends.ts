type LiveFriend = {
  readonly has_shared_files: boolean;
  readonly name: string;
};

type LiveFriendsClient = {
  readonly friends: {
    readonly list: () => Promise<{
      readonly friends: ReadonlyArray<LiveFriend>;
    }>;
  };
};

export const findLiveFriend = async (
  client: LiveFriendsClient,
  predicate: (friend: LiveFriend) => boolean = () => true,
): Promise<LiveFriend | null> => {
  const { friends } = await client.friends.list();
  return friends.find(predicate) ?? null;
};

export const liveFriendFixtureSkip = (reason: string) => ({
  reason,
  skipped: true,
});
