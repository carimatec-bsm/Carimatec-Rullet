export type Prize = {
  id: string;
  name: string;
  label: string;
  description: string;
  image: string;
  color: string;
  weight: number;
  active: boolean;
  initialStock: number;
  unlimited: boolean;
  isLose: boolean;
};
export type Customer = {
  name: string;
  company: string;
  phone: string;
  email: string;
};
export type CustomerField = keyof Customer;
export type Config = {
  version: 1;
  revision: string;
  baseRevision?: string;
  eventId: string;
  event: {
    name: string;
    mainTitle: string;
    subTitle: string;
    guide: string;
    startDate: string;
    endDate: string;
    enforceDates: boolean;
    surveyUrl: string;
  };
  display: {
    theme: "light" | "dark" | "grid";
    layout: "auto" | "landscape" | "portrait";
    names: boolean;
    images: boolean;
    probabilities: boolean;
    descriptions: boolean;
  };
  behavior: {
    autoExclude: boolean;
    duration: number;
    paused: boolean;
    collectCustomers: boolean;
    required: Record<CustomerField, boolean>;
  };
  prizes: Prize[];
};
export type Participant = Customer & {
  id: string;
  eventId: string;
  time: string;
  prizeId: string;
  prizeName: string;
  isLose: boolean;
};
export type PendingSpin = {
  record: Participant;
  prize: Prize;
  wheel: Prize[];
  display: Config["display"];
  target: number;
  startedAt: number;
  duration: number;
};
export type Store = {
  version: 1;
  config: Config;
  records: Participant[];
  used: Record<string, number>;
  pending: PendingSpin | null;
};
