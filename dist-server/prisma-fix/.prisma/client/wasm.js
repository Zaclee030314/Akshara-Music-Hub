
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('@prisma/client/runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.QuestScalarFieldEnum = {
  id: 'id',
  title: 'title',
  subject: 'subject',
  grade: 'grade',
  syllabus: 'syllabus',
  creatorId: 'creatorId',
  questions: 'questions',
  createdAt: 'createdAt'
};

exports.Prisma.ResultScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  questId: 'questId',
  score: 'score',
  correctAnswers: 'correctAnswers',
  totalQuestions: 'totalQuestions',
  mode: 'mode',
  subject: 'subject',
  topic: 'topic',
  grade: 'grade',
  xpAwarded: 'xpAwarded',
  coinsAwarded: 'coinsAwarded',
  date: 'date'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  name: 'name',
  role: 'role',
  grade: 'grade',
  gradeSyllabus: 'gradeSyllabus',
  birthday: 'birthday',
  avatar: 'avatar',
  parentName: 'parentName',
  parentPhone: 'parentPhone',
  parentEmail: 'parentEmail',
  children: 'children',
  profileCompleted: 'profileCompleted',
  createdAt: 'createdAt',
  xp: 'xp',
  coins: 'coins',
  isSubscribed: 'isSubscribed',
  isVerified: 'isVerified',
  verificationCode: 'verificationCode',
  stripeCustomerId: 'stripeCustomerId',
  subscriptionInterval: 'subscriptionInterval',
  subscriptionStartDate: 'subscriptionStartDate',
  subscriptionEndDate: 'subscriptionEndDate',
  subscriptionLevel: 'subscriptionLevel',
  subscribedSyllabus: 'subscribedSyllabus',
  cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  isAdmin: 'isAdmin',
  questsPlayed: 'questsPlayed',
  questsCreated: 'questsCreated',
  resetPasswordOtp: 'resetPasswordOtp',
  resetPasswordOtpExpiry: 'resetPasswordOtpExpiry',
  referralCode: 'referralCode',
  referredById: 'referredById',
  referralCreditCents: 'referralCreditCents',
  referralRewardGranted: 'referralRewardGranted',
  language: 'language',
  lastSeenSeasonId: 'lastSeenSeasonId',
  parentId: 'parentId',
  archivedAt: 'archivedAt',
  subscriptionSeats: 'subscriptionSeats'
};

exports.Prisma.SeasonScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  prizeTitle: 'prizeTitle',
  prizeDetails: 'prizeDetails',
  secondPlacePoints: 'secondPlacePoints',
  thirdPlacePoints: 'thirdPlacePoints',
  secondPrizeTitle: 'secondPrizeTitle',
  thirdPrizeTitle: 'thirdPrizeTitle',
  firstPrizeCoins: 'firstPrizeCoins',
  secondPrizeCoins: 'secondPrizeCoins',
  thirdPrizeCoins: 'thirdPrizeCoins',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  createdAt: 'createdAt',
  finalizedAt: 'finalizedAt'
};

exports.Prisma.SeasonStandingScalarFieldEnum = {
  id: 'id',
  seasonId: 'seasonId',
  userId: 'userId',
  rank: 'rank',
  points: 'points',
  name: 'name',
  avatar: 'avatar',
  grade: 'grade'
};

exports.Prisma.SeasonWinnerScalarFieldEnum = {
  id: 'id',
  seasonId: 'seasonId',
  userId: 'userId',
  rank: 'rank',
  points: 'points',
  awardedPoints: 'awardedPoints',
  prizeTitle: 'prizeTitle'
};

exports.Prisma.PollScalarFieldEnum = {
  id: 'id',
  question: 'question',
  description: 'description',
  options: 'options',
  allowSuggestions: 'allowSuggestions',
  isActive: 'isActive',
  seasonId: 'seasonId',
  createdAt: 'createdAt',
  suggestedMeta: 'suggestedMeta',
  removedOptions: 'removedOptions'
};

exports.Prisma.PollVoteScalarFieldEnum = {
  id: 'id',
  pollId: 'pollId',
  userId: 'userId',
  optionIndex: 'optionIndex',
  suggestion: 'suggestion',
  createdAt: 'createdAt'
};

exports.Prisma.RewardScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  coinCost: 'coinCost',
  icon: 'icon',
  imageUrl: 'imageUrl',
  stock: 'stock',
  isActive: 'isActive',
  createdAt: 'createdAt',
  creatorId: 'creatorId'
};

exports.Prisma.RedemptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  rewardId: 'rewardId',
  status: 'status',
  redeemedAt: 'redeemedAt',
  receiverName: 'receiverName',
  receiverPhone: 'receiverPhone',
  receiverAddress: 'receiverAddress'
};

exports.Prisma.PendingUserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  name: 'name',
  role: 'role',
  grade: 'grade',
  syllabus: 'syllabus',
  birthday: 'birthday',
  parentPhone: 'parentPhone',
  referredById: 'referredById',
  verificationCode: 'verificationCode',
  createdAt: 'createdAt'
};

exports.Prisma.QuestionBankScalarFieldEnum = {
  id: 'id',
  subject: 'subject',
  grade: 'grade',
  syllabus: 'syllabus',
  topic: 'topic',
  subtopic: 'subtopic',
  year: 'year',
  question: 'question',
  options: 'options',
  correctAnswer: 'correctAnswer',
  explanation: 'explanation',
  difficulty: 'difficulty',
  classification: 'classification',
  source: 'source',
  createdAt: 'createdAt'
};

exports.Prisma.AppSettingScalarFieldEnum = {
  key: 'key',
  value: 'value'
};

exports.Prisma.ReferralTierScalarFieldEnum = {
  id: 'id',
  minCount: 'minCount',
  maxCount: 'maxCount',
  amountCents: 'amountCents',
  splitMonths: 'splitMonths',
  sortOrder: 'sortOrder'
};

exports.Prisma.ReferralEarningScalarFieldEnum = {
  id: 'id',
  referrerId: 'referrerId',
  referredUserId: 'referredUserId',
  tierAmountCents: 'tierAmountCents',
  splitMonths: 'splitMonths',
  createdAt: 'createdAt'
};

exports.Prisma.ReferralInstalmentScalarFieldEnum = {
  id: 'id',
  earningId: 'earningId',
  dueDate: 'dueDate',
  amountCents: 'amountCents',
  creditedAt: 'creditedAt'
};

exports.Prisma.ServedQuestionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  subject: 'subject',
  grade: 'grade',
  syllabus: 'syllabus',
  questionHash: 'questionHash',
  questionText: 'questionText',
  createdAt: 'createdAt'
};

exports.Prisma.CourseSyllabusScalarFieldEnum = {
  id: 'id',
  subject: 'subject',
  grade: 'grade',
  syllabus: 'syllabus',
  language: 'language',
  topics: 'topics',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaperFileScalarFieldEnum = {
  id: 'id',
  syllabus: 'syllabus',
  grade: 'grade',
  subject: 'subject',
  year: 'year',
  label: 'label',
  fileData: 'fileData',
  fileSize: 'fileSize',
  createdAt: 'createdAt'
};

exports.Prisma.StudyPlanScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  overview: 'overview',
  subject: 'subject',
  grade: 'grade',
  syllabus: 'syllabus',
  timeframe: 'timeframe',
  createdAt: 'createdAt'
};

exports.Prisma.StudyTaskScalarFieldEnum = {
  id: 'id',
  planId: 'planId',
  weekNumber: 'weekNumber',
  day: 'day',
  title: 'title',
  topicSearch: 'topicSearch',
  isCompleted: 'isCompleted',
  completedAt: 'completedAt'
};

exports.Prisma.ClassroomScalarFieldEnum = {
  id: 'id',
  name: 'name',
  joinCode: 'joinCode',
  teacherId: 'teacherId',
  createdAt: 'createdAt'
};

exports.Prisma.AssignmentScalarFieldEnum = {
  id: 'id',
  classroomId: 'classroomId',
  title: 'title',
  description: 'description',
  questId: 'questId',
  dueDate: 'dueDate',
  createdAt: 'createdAt'
};

exports.Prisma.AssignmentSubmissionScalarFieldEnum = {
  id: 'id',
  assignmentId: 'assignmentId',
  studentId: 'studentId',
  status: 'status',
  score: 'score',
  proofUrl: 'proofUrl',
  completedAt: 'completedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Quest: 'Quest',
  Result: 'Result',
  User: 'User',
  Season: 'Season',
  SeasonStanding: 'SeasonStanding',
  SeasonWinner: 'SeasonWinner',
  Poll: 'Poll',
  PollVote: 'PollVote',
  Reward: 'Reward',
  Redemption: 'Redemption',
  PendingUser: 'PendingUser',
  QuestionBank: 'QuestionBank',
  AppSetting: 'AppSetting',
  ReferralTier: 'ReferralTier',
  ReferralEarning: 'ReferralEarning',
  ReferralInstalment: 'ReferralInstalment',
  ServedQuestion: 'ServedQuestion',
  CourseSyllabus: 'CourseSyllabus',
  PaperFile: 'PaperFile',
  StudyPlan: 'StudyPlan',
  StudyTask: 'StudyTask',
  Classroom: 'Classroom',
  Assignment: 'Assignment',
  AssignmentSubmission: 'AssignmentSubmission'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
