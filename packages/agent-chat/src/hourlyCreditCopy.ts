/** Hourly computer sentences. China Chinese says 星币. Overseas Chinese says credit. */

export type HourlyCreditCopy = {
  screenAt: string;
  sendAt: string;
  sendConfirm: string;
  pausedAt: string;
  runningAt: string;
  pauseAt: string;
  resumeAt: string;
  resumeConfirm: string;
  pauseConfirm: string;
};

const EN: HourlyCreditCopy = {
  screenAt: "Open computer screen · {rate} credits/hr",
  sendAt: "Send · {rate}/hr",
  sendConfirm:
    "Sending starts this computer at {rate} credits per hour. Unused prepaid is returned.",
  pausedAt: "Paused · {rate}/hr",
  runningAt: "On · {rate}/hr",
  pauseAt: "Pause · {rate}/hr",
  resumeAt: "Resume · {rate}/hr",
  resumeConfirm: "Resume bills {rate} credits per hour. Unused prepaid is returned.",
  pauseConfirm: "Pause bills {rate} credits per hour.",
};

const ZH_CN: HourlyCreditCopy = {
  screenAt: "打开电脑屏幕 · {rate} 星币/小时",
  sendAt: "发送 · {rate} 星币/小时",
  sendConfirm: "发送后电脑按 {rate} 星币/小时计费。不用的预扣会退回。",
  pausedAt: "暂停 {rate} 星币/小时",
  runningAt: "开着 {rate} 星币/小时",
  pauseAt: "暂停 · {rate} 星币/小时",
  resumeAt: "恢复 · {rate} 星币/小时",
  resumeConfirm: "恢复按 {rate} 星币/小时计费。不用的预扣会退回。",
  pauseConfirm: "暂停后按 {rate} 星币/小时计费。",
};

const ZH_OVERSEAS: HourlyCreditCopy = {
  screenAt: "打开电脑屏幕 · 每小时 {rate} credits",
  sendAt: "发送 · 每小时 {rate} credits",
  sendConfirm: "发送后电脑按每小时 {rate} credits 计费。不用的预扣会退回。",
  pausedAt: "暂停 · 每小时 {rate} credits",
  runningAt: "开着 · 每小时 {rate} credits",
  pauseAt: "暂停 · 每小时 {rate} credits",
  resumeAt: "恢复 · 每小时 {rate} credits",
  resumeConfirm: "恢复后电脑按每小时 {rate} credits 计费。不用的预扣会退回。",
  pauseConfirm: "暂停后电脑按每小时 {rate} credits 计费。",
};

export function hourlyCreditCopy(locale?: string | null, cn = true): HourlyCreditCopy {
  const zh = (locale || "").trim().toLowerCase().startsWith("zh");
  if (!zh) return EN;
  return cn ? ZH_CN : ZH_OVERSEAS;
}
