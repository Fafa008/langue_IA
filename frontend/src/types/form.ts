export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export type Validator<T> = (values: T) => FieldErrors<T>;
