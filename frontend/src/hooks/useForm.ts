"use client";
import { useState, type FormEvent } from "react";
import type { FieldErrors, Validator } from "@/types/form";

interface UseFormOptions<T> {
  initialValues: T;
  validate: Validator<T>;
  onSubmit: (values: T) => void;
}

/**
 * État de formulaire minimal : valeurs, erreurs et soumission.
 * Les erreurs n'apparaissent qu'après une première tentative d'envoi,
 * puis sont recalculées à chaque frappe. En cas d'erreur, le premier champ invalide reçoit le focus.
 */
/** Place le focus (et donc fait défiler la page) sur le premier champ marqué aria-invalid. */
function focusFirstInvalidField(form: HTMLFormElement) {
  // Attend l'affichage des erreurs, qui pose les attributs aria-invalid
  requestAnimationFrame(() => {
    const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    // Pour un groupe (fieldset), on cible sa première case
    const target = invalid?.matches("fieldset") ? invalid.querySelector<HTMLElement>("input") : invalid;
    target?.focus();
  });
}

export function useForm<T extends object>({ initialValues, validate, onSubmit }: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FieldErrors<T>>({});
  const [submitted, setSubmitted] = useState(false);

  function setField<K extends keyof T>(name: K, value: T[K]) {
    const next = { ...values, [name]: value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(values);
    else focusFirstInvalidField(event.currentTarget);
  }

  return { values, errors, setField, handleSubmit };
}
