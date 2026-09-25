export type SettingValue = boolean | string | number;

export type SettingValues = Record<string, SettingValue>;

export type SettingOption = {
  value: string;
  labelKey: string;
};

export type SettingField =
  | { kind: "boolean"; key: string }
  | { kind: "radio"; key: string; options: SettingOption[] }
  | { kind: "text"; key: string; placeholderKey?: string; prefix?: string; secret?: boolean }
  | { kind: "number"; key: string; suffixKey?: string; min?: number; max?: number; step?: number }
  | { kind: "color"; key: string }
  | { kind: "select"; key: string; options: SettingOption[] }
  | { kind: "action"; labelKey: string; href?: string }
  | { kind: "info"; labelKey: string };

export type SettingItem = {
  id: string;
  titleKey: string;
  descKey?: string;
  /** When set, item is shown only if this boolean key is true */
  whenKey?: string;
  fields: SettingField[];
};

export type SettingSection = {
  id: string;
  titleKey: string;
  items: SettingItem[];
};

export type SettingTab = {
  id: string;
  titleKey: string;
  icon: SettingIconId;
  sections: SettingSection[];
};

export type SettingIconId =
  | "general"
  | "crm"
  | "sales"
  | "calendar"
  | "website"
  | "purchase"
  | "inventory"
  | "accounting"
  | "project"
  | "sign"
  | "planning"
  | "email"
  | "employees"
  | "fleet";
