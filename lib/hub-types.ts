export type Modality = 'cardio' | 'strength'
export type Challenge = { id: string; modality: Modality; name: string; description: string | null; profilePathname: string | null; coverPathname: string | null; goalType: string; goalValue: string | null; startDate: string; endDate: string; joinCode: string; ownerId: string; memberCount: number }
export type Member = { id: string; name: string; image: string | null; joinedAt: string; isOwner: boolean; workouts: number; checkIns: number; activeDays: number; lastTrainingDate: string | null; minutes: number; kilometers: number; pace: number | null }
export type FeedItem = { captureDay: string | null; gestureId: string | null; id: string; modality: Modality; userId: string; name: string; image: string | null; recordDate: string; createdAt: string; minutes: number; kilometers: string; pace: string | null; activityType: string; proofPathname: string; description: string | null }

export type RecordPublication = { record: { modality: Modality; recordDate: string }; alreadyPublished: boolean; replaced?: boolean; countedChallengeIds: string[] }

export type ExistingStrengthRecord = { id: string; submissionKey: string | null; recordDate: string }
