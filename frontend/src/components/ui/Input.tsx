import { forwardRef, type ChangeEvent, type CompositionEvent, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /**
   * Mise en forme appliquée pendant la saisie (majuscules, caractères interdits retirés…).
   * Elle doit traiter le texte de gauche à droite : format(début) doit être le début de format(texte).
   */
  format?: (value: string) => string;
}

/**
 * Applique `format` directement sur le champ en gardant le curseur au bon endroit :
 * sans cela, il sauterait en fin de texte quand on corrige au milieu d'un mot.
 * Renvoie true si le texte a changé.
 */
function applyFormat(input: HTMLInputElement, format: (value: string) => string): boolean {
  const { value, selectionStart } = input;
  const formatted = format(value);
  if (formatted === value) return false;
  input.value = formatted;
  // Le curseur se place juste après la version mise en forme de ce qui le précédait
  if (selectionStart !== null) {
    const position = format(value.slice(0, selectionStart)).length;
    input.setSelectionRange(position, position);
  }
  return true;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, format, className = "", onChange, onCompositionEnd, ...props },
  ref,
) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // Pendant une composition (clavier Android, touches mortes pour les accents), modifier
    // le champ casserait la saisie en cours : on attend la fin de la composition.
    const isComposing = (event.nativeEvent as InputEvent).isComposing;
    if (format && !isComposing) applyFormat(event.target, format);
    onChange?.(event);
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    onCompositionEnd?.(event);
    // Aucun événement « change » ne suit la fin d'une composition : on transmet nous-mêmes
    // la valeur mise en forme (le parent ne lit que event.target.value).
    if (format && applyFormat(event.currentTarget, format)) {
      onChange?.(event as unknown as ChangeEvent<HTMLInputElement>);
    }
  }

  return (
    <input
      ref={ref}
      {...props}
      onChange={handleChange}
      onCompositionEnd={handleCompositionEnd}
      aria-invalid={invalid}
      className={`input ${invalid ? "input-error" : ""} ${className}`}
    />
  );
});

export default Input;
