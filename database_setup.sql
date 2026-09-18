-- CreateTable
CREATE TABLE `Quest` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `syllabus` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `questions` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Quest_creatorId_idx`(`creatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Result` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questId` VARCHAR(191) NULL,
    `score` INTEGER NOT NULL,
    `correctAnswers` INTEGER NOT NULL DEFAULT 0,
    `totalQuestions` INTEGER NOT NULL DEFAULT 0,
    `mode` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `topic` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `xpAwarded` INTEGER NOT NULL DEFAULT 0,
    `coinsAwarded` INTEGER NOT NULL DEFAULT 0,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Result_questId_idx`(`questId`),
    INDEX `Result_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NULL,
    `gradeSyllabus` VARCHAR(191) NULL,
    `birthday` DATETIME(3) NULL,
    `avatar` VARCHAR(191) NULL,
    `parentName` VARCHAR(191) NULL,
    `parentPhone` VARCHAR(191) NULL,
    `parentEmail` VARCHAR(191) NULL,
    `children` VARCHAR(191) NULL,
    `profileCompleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `xp` INTEGER NOT NULL DEFAULT 0,
    `coins` INTEGER NOT NULL DEFAULT 0,
    `isSubscribed` BOOLEAN NOT NULL DEFAULT false,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `verificationCode` VARCHAR(191) NULL,
    `stripeCustomerId` VARCHAR(191) NULL,
    `subscriptionInterval` VARCHAR(191) NULL,
    `subscriptionStartDate` DATETIME(3) NULL,
    `subscriptionEndDate` DATETIME(3) NULL,
    `subscriptionLevel` VARCHAR(191) NULL,
    `subscribedSyllabus` VARCHAR(191) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `isAdmin` BOOLEAN NOT NULL DEFAULT false,
    `questsPlayed` INTEGER NOT NULL DEFAULT 0,
    `questsCreated` INTEGER NOT NULL DEFAULT 0,
    `resetPasswordOtp` VARCHAR(191) NULL,
    `resetPasswordOtpExpiry` DATETIME(3) NULL,
    `referralCode` VARCHAR(191) NULL,
    `referredById` VARCHAR(191) NULL,
    `referralCreditCents` INTEGER NOT NULL DEFAULT 0,
    `referralRewardGranted` BOOLEAN NOT NULL DEFAULT false,
    `language` VARCHAR(191) NULL,
    `lastSeenSeasonId` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `archivedAt` DATETIME(3) NULL,
    `subscriptionSeats` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_referralCode_key`(`referralCode`),
    INDEX `User_referredById_idx`(`referredById`),
    INDEX `User_parentId_idx`(`parentId`),
    INDEX `User_role_xp_idx`(`role`, `xp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Season` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `prizeTitle` VARCHAR(191) NOT NULL,
    `prizeDetails` VARCHAR(191) NULL,
    `secondPlacePoints` INTEGER NOT NULL DEFAULT 0,
    `thirdPlacePoints` INTEGER NOT NULL DEFAULT 0,
    `secondPrizeTitle` VARCHAR(191) NULL,
    `thirdPrizeTitle` VARCHAR(191) NULL,
    `firstPrizeCoins` INTEGER NOT NULL DEFAULT 0,
    `secondPrizeCoins` INTEGER NOT NULL DEFAULT 0,
    `thirdPrizeCoins` INTEGER NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'upcoming',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finalizedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonStanding` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,

    INDEX `SeasonStanding_seasonId_idx`(`seasonId`),
    INDEX `SeasonStanding_userId_idx`(`userId`),
    UNIQUE INDEX `SeasonStanding_seasonId_rank_key`(`seasonId`, `rank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonWinner` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `awardedPoints` INTEGER NOT NULL DEFAULT 0,
    `prizeTitle` VARCHAR(191) NOT NULL,

    INDEX `SeasonWinner_userId_idx`(`userId`),
    UNIQUE INDEX `SeasonWinner_seasonId_rank_key`(`seasonId`, `rank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Poll` (
    `id` VARCHAR(191) NOT NULL,
    `question` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `options` VARCHAR(191) NOT NULL,
    `allowSuggestions` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `seasonId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `suggestedMeta` VARCHAR(191) NULL,
    `removedOptions` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PollVote` (
    `id` VARCHAR(191) NOT NULL,
    `pollId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `optionIndex` INTEGER NULL,
    `suggestion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PollVote_pollId_userId_key`(`pollId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reward` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `coinCost` INTEGER NOT NULL,
    `icon` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `stock` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `creatorId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Redemption` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `rewardId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receiverName` VARCHAR(191) NULL,
    `receiverPhone` VARCHAR(191) NULL,
    `receiverAddress` VARCHAR(191) NULL,

    INDEX `Redemption_userId_idx`(`userId`),
    INDEX `Redemption_rewardId_idx`(`rewardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PendingUser` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NULL,
    `syllabus` VARCHAR(191) NULL,
    `birthday` DATETIME(3) NULL,
    `parentPhone` VARCHAR(191) NULL,
    `referredById` VARCHAR(191) NULL,
    `verificationCode` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PendingUser_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionBank` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `syllabus` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `subtopic` VARCHAR(191) NULL,
    `year` INTEGER NOT NULL,
    `question` VARCHAR(191) NOT NULL,
    `options` VARCHAR(191) NOT NULL,
    `correctAnswer` VARCHAR(191) NOT NULL,
    `explanation` VARCHAR(191) NOT NULL,
    `difficulty` VARCHAR(191) NOT NULL,
    `classification` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestionBank_subject_grade_syllabus_topic_idx`(`subject`, `grade`, `syllabus`, `topic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralTier` (
    `id` VARCHAR(191) NOT NULL,
    `minCount` INTEGER NOT NULL,
    `maxCount` INTEGER NULL,
    `amountCents` INTEGER NOT NULL,
    `splitMonths` INTEGER NOT NULL DEFAULT 1,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralEarning` (
    `id` VARCHAR(191) NOT NULL,
    `referrerId` VARCHAR(191) NOT NULL,
    `referredUserId` VARCHAR(191) NOT NULL,
    `tierAmountCents` INTEGER NOT NULL,
    `splitMonths` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ReferralEarning_referredUserId_key`(`referredUserId`),
    INDEX `ReferralEarning_referrerId_idx`(`referrerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralInstalment` (
    `id` VARCHAR(191) NOT NULL,
    `earningId` VARCHAR(191) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `creditedAt` DATETIME(3) NULL,

    INDEX `ReferralInstalment_earningId_idx`(`earningId`),
    INDEX `ReferralInstalment_dueDate_creditedAt_idx`(`dueDate`, `creditedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServedQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `syllabus` VARCHAR(191) NULL,
    `questionHash` VARCHAR(191) NOT NULL,
    `questionText` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServedQuestion_userId_subject_grade_idx`(`userId`, `subject`, `grade`),
    UNIQUE INDEX `ServedQuestion_userId_questionHash_key`(`userId`, `questionHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseSyllabus` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `syllabus` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `topics` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CourseSyllabus_subject_grade_syllabus_language_key`(`subject`, `grade`, `syllabus`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaperFile` (
    `id` VARCHAR(191) NOT NULL,
    `syllabus` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `fileData` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaperFile_syllabus_grade_subject_year_idx`(`syllabus`, `grade`, `subject`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudyPlan` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `overview` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `syllabus` VARCHAR(191) NOT NULL,
    `timeframe` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StudyPlan_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudyTask` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `weekNumber` INTEGER NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `topicSearch` VARCHAR(191) NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,

    INDEX `StudyTask_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Classroom` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `joinCode` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Classroom_joinCode_key`(`joinCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Assignment` (
    `id` VARCHAR(191) NOT NULL,
    `classroomId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `questId` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssignmentSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `score` INTEGER NULL,
    `proofUrl` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AssignmentSubmission_assignmentId_studentId_key`(`assignmentId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_StudentClassrooms` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_StudentClassrooms_AB_unique`(`A`, `B`),
    INDEX `_StudentClassrooms_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Quest` ADD CONSTRAINT `Quest_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Result` ADD CONSTRAINT `Result_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Result` ADD CONSTRAINT `Result_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonStanding` ADD CONSTRAINT `SeasonStanding_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonWinner` ADD CONSTRAINT `SeasonWinner_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonWinner` ADD CONSTRAINT `SeasonWinner_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PollVote` ADD CONSTRAINT `PollVote_pollId_fkey` FOREIGN KEY (`pollId`) REFERENCES `Poll`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PollVote` ADD CONSTRAINT `PollVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Redemption` ADD CONSTRAINT `Redemption_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Redemption` ADD CONSTRAINT `Redemption_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralInstalment` ADD CONSTRAINT `ReferralInstalment_earningId_fkey` FOREIGN KEY (`earningId`) REFERENCES `ReferralEarning`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudyPlan` ADD CONSTRAINT `StudyPlan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudyTask` ADD CONSTRAINT `StudyTask_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `StudyPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Classroom` ADD CONSTRAINT `Classroom_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `Classroom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignmentSubmission` ADD CONSTRAINT `AssignmentSubmission_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `Assignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignmentSubmission` ADD CONSTRAINT `AssignmentSubmission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_StudentClassrooms` ADD CONSTRAINT `_StudentClassrooms_A_fkey` FOREIGN KEY (`A`) REFERENCES `Classroom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_StudentClassrooms` ADD CONSTRAINT `_StudentClassrooms_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

