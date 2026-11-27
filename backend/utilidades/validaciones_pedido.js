function coordenadasValidas(latitud, longitud) {
  const latitudVacia = latitud === '' || latitud == null;
  const longitudVacia = longitud === '' || longitud == null;
  if (latitudVacia && longitudVacia) return true;
  if (latitudVacia || longitudVacia) return false;
  const numeroValido = (valor) => {
    if (typeof valor === 'number') return Number.isFinite(valor);
    return typeof valor === 'string' &&
      /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(valor.trim()) &&
      Number.isFinite(Number(valor));
  };
  if (!numeroValido(latitud) || !numeroValido(longitud)) return false;

  const lat = Number(latitud);
  const lon = Number(longitud);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

module.exports = { coordenadasValidas };
