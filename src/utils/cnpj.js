/**
 * Valida CNPJ (14 dígitos) com dígitos verificadores.
 * @param {string} cnpjString — com ou sem formatação
 * @returns {boolean}
 */
export function isValidCnpj(cnpjString) {
  const cnpj = String(cnpjString).replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (len) => {
    const nums = cnpj.substring(0, len);
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += parseInt(nums[i], 10) * weights[i];
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const d1 = calc(12);
  if (d1 !== parseInt(cnpj[12], 10)) return false;
  const d2 = calc(13);
  return d2 === parseInt(cnpj[13], 10);
}

/** 99.999.999/9999-99 */
export function formatCnpjInput(digits) {
  const d = String(digits).replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
