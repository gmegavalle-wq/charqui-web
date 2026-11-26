function crearLimitadorSolicitudes({ limite, ventanaMs, maxClaves = 5000, reloj = Date.now }) {
  if (!Number.isInteger(limite) || limite < 1 ||
      !Number.isInteger(ventanaMs) || ventanaMs < 1 ||
      !Number.isInteger(maxClaves) || maxClaves < 1) {
    throw new TypeError('La configuración del limitador no es válida.');
  }

  const registros = new Map();
  let proximaLimpieza = 0;

  return function limitarSolicitudes(req, res, siguiente) {
    const ahora = reloj();
    if (ahora >= proximaLimpieza) {
      while (registros.size) {
        const [claveMasAntigua, registroMasAntiguo] = registros.entries().next().value;
        if (registroMasAntiguo.venceEn > ahora) break;
        registros.delete(claveMasAntigua);
      }
      proximaLimpieza = ahora + Math.min(ventanaMs, 60_000);
    }

    const clave = req.ip || req.socket?.remoteAddress || 'ip-desconocida';
    let registro = registros.get(clave);
    if (!registro || registro.venceEn <= ahora) {
      if (!registro && registros.size >= maxClaves) {
        return res.status(503).json({ error: 'El servicio está ocupado. Inténtalo más tarde.' });
      }
      if (registro) registros.delete(clave);
      registro = { solicitudes: 0, venceEn: ahora + ventanaMs };
      registros.set(clave, registro);
    }

    if (registro.solicitudes >= limite) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((registro.venceEn - ahora) / 1000))));
      return res.status(429).json({ error: 'Has realizado demasiadas solicitudes. Inténtalo más tarde.' });
    }

    registro.solicitudes += 1;
    return siguiente();
  };
}

module.exports = crearLimitadorSolicitudes;
