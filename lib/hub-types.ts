export type Challenge = { id: string; name: string; description: string | null; profilePathname: string | null; coverPathname: string | null; goalType: string; goalValue: string | null; startDate: string; endDate: string; joinCode: string; ownerId: string; memberCount: number }
export type Member = { id: string; name: string; image: string | null; joinedAt: string; isOwner: boolean; workouts: number; activeDays: number; lastTrainingDate: string | null; minutes: number; kilometers: number; pace: number | null }
export type FeedItem = { id: string; userId: string; name: string; image: string | null; recordDate: string; createdAt: string; minutes: number; kilometers: string; pace: string | null; activityType: string; proofPathname: string; description: string | null }

export type RecordPublication = { alreadyPublished: boolean; countedChallengeIds: string[] }
