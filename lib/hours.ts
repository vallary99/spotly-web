import type { Business } from "./api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface OpenStatus {
  open: boolean;
  label: string;
}

export function computeOpenStatus(hours?: Business["hours"]): OpenStatus | null {
  if (!hours) return null;
  const now = new Date();
  const todayKey = DAYS[now.getDay()];
  const today = hours[todayKey];
  if (!today) return { open: false, label: "Closed today" };
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const openMins = oh * 60 + om;
  const closeMins = ch * 60 + cm;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const isOpen = nowMins >= openMins && nowMins < closeMins;
  return { open: isOpen, label: isOpen ? `Open now, closes ${today.close}` : `Closed, opens ${today.open}` };
}

export { DAYS };
