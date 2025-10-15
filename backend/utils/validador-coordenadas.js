/**
 * Módulo de validação de coordenadas geodésicas
 * Valida coordenadas UTM Zone 22S e converte para WGS84
 */

const proj4 = require('proj4');

// Definir projeções
proj4.defs("EPSG:31982", "+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

/**
 * Valida coordenada UTM
 * @param {number} e - Coordenada E (Este)
 * @param {number} n - Coordenada N (Norte)
 * @param {number} zona - Zona UTM (padrão 22)
 * @returns {Object} { valido: boolean, erro: string|null }
 */
function validarCoordenadaUTM(e, n, zona = 22) {
    // Verificar valores nulos ou zero
    if (e === null || e === undefined || n === null || n === undefined) {
        return { valido: false, erro: 'VALORES_NULOS' };
    }

    if (e === 0 || n === 0) {
        return { valido: false, erro: 'VALORES_NULOS' };
    }

    // Verificar valores absurdos
    if (Math.abs(e) > 99999999 || Math.abs(n) > 99999999) {
        return { valido: false, erro: 'VALORES_ABSURDOS' };
    }

    // Verificar se não é NaN ou Infinity
    if (!isFinite(e) || !isFinite(n) || isNaN(e) || isNaN(n)) {
        return { valido: false, erro: 'VALORES_ABSURDOS' };
    }

    // Validar range da Zona 22S
    // Coordenada E válida: 166.000m <= E <= 834.000m
    if (e < 166000 || e > 834000) {
        return { valido: false, erro: 'UTM_INVALIDO' };
    }

    // Coordenada N válida: 0m <= N <= 10.000.000m
    if (n < 0 || n > 10000000) {
        return { valido: false, erro: 'UTM_INVALIDO' };
    }

    return { valido: true, erro: null };
}

/**
 * Valida coordenada Lat/Lng (WGS84)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object} { valido: boolean, erro: string|null }
 */
function validarCoordenadaLatLng(lat, lng) {
    // Verificar valores nulos
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
        return { valido: false, erro: 'VALORES_NULOS' };
    }

    // Verificar se não é NaN ou Infinity
    if (!isFinite(lat) || !isFinite(lng) || isNaN(lat) || isNaN(lng)) {
        return { valido: false, erro: 'CONVERSAO_FALHOU' };
    }

    // Validar bounding box do Brasil
    // Latitude: -34° <= lat <= 6°
    // Longitude: -74° <= lng <= -34°
    if (lat < -34 || lat > 6) {
        return { valido: false, erro: 'FORA_BRASIL' };
    }

    if (lng < -74 || lng > -34) {
        return { valido: false, erro: 'FORA_BRASIL' };
    }

    return { valido: true, erro: null };
}

/**
 * Converte coordenada UTM para Lat/Lng
 * @param {number} e - Coordenada E
 * @param {number} n - Coordenada N
 * @returns {Object} { lat: number, lng: number } ou null se falhar
 */
function converterUTMparaLatLng(e, n) {
    try {
        const [lng, lat] = proj4('EPSG:31982', 'EPSG:4326', [e, n]);
        return { lat, lng };
    } catch (error) {
        console.error('Erro ao converter coordenadas:', error);
        return null;
    }
}

/**
 * Valida marco completo (UTM + conversão Lat/Lng)
 * @param {Object} marco - Objeto marco com coordenada_e e coordenada_n
 * @returns {Object} { valido: boolean, erro: string|null, detalhes: object }
 */
function validarMarco(marco) {
    const resultado = {
        valido: false,
        erro: null,
        detalhes: {
            coordenada_e: marco.coordenada_e,
            coordenada_n: marco.coordenada_n,
            lat: null,
            lng: null
        }
    };

    // 1. Validar UTM
    const validacaoUTM = validarCoordenadaUTM(marco.coordenada_e, marco.coordenada_n);
    if (!validacaoUTM.valido) {
        resultado.erro = validacaoUTM.erro;
        return resultado;
    }

    // 2. Tentar converter para Lat/Lng
    const coordLatLng = converterUTMparaLatLng(marco.coordenada_e, marco.coordenada_n);
    if (!coordLatLng) {
        resultado.erro = 'CONVERSAO_FALHOU';
        return resultado;
    }

    resultado.detalhes.lat = coordLatLng.lat;
    resultado.detalhes.lng = coordLatLng.lng;

    // 3. Validar Lat/Lng
    const validacaoLatLng = validarCoordenadaLatLng(coordLatLng.lat, coordLatLng.lng);
    if (!validacaoLatLng.valido) {
        resultado.erro = validacaoLatLng.erro;
        return resultado;
    }

    // Tudo válido
    resultado.valido = true;
    return resultado;
}

/**
 * Obter descrição do erro
 * @param {string} codigoErro - Código do erro
 * @returns {string} Descrição legível do erro
 */
function obterDescricaoErro(codigoErro) {
    const erros = {
        'UTM_INVALIDO': 'Coordenadas UTM fora do range válido para Zona 22S',
        'FORA_BRASIL': 'Coordenadas convertidas estão fora do território brasileiro',
        'VALORES_NULOS': 'Coordenadas nulas ou zeradas',
        'CONVERSAO_FALHOU': 'Falha na conversão de coordenadas',
        'VALORES_ABSURDOS': 'Valores numéricos inválidos ou absurdos'
    };

    return erros[codigoErro] || 'Erro desconhecido';
}

/**
 * Valida todos os marcos do banco de dados
 * @param {Object} db - Instância do banco de dados SQLite
 * @param {boolean} forcar - Forçar revalidação de marcos já validados
 * @returns {Object} { total, validos, invalidos, detalhes: [], tempo_ms }
 */
function validarTodosMarcos(db, forcar = false) {
    const inicio = Date.now();

    // Query para buscar marcos
    let query = 'SELECT id, codigo, tipo, coordenada_e, coordenada_n FROM marcos WHERE ativo = 1';
    if (!forcar) {
        query += ' AND coordenadas_validadas IS NULL';
    }

    const marcos = db.prepare(query).all();

    const estatisticas = {
        total: marcos.length,
        validos: 0,
        invalidos: 0,
        detalhes: []
    };

    // Usar transação para melhor performance
    const updateStmt = db.prepare(`
        UPDATE marcos
        SET coordenadas_validadas = ?,
            erro_validacao = ?,
            data_validacao = ?
        WHERE id = ?
    `);

    const transaction = db.transaction((marcosLista) => {
        for (const marco of marcosLista) {
            const validacao = validarMarco(marco);
            const dataValidacao = new Date().toISOString();

            if (validacao.valido) {
                updateStmt.run(1, null, dataValidacao, marco.id);
                estatisticas.validos++;
            } else {
                const descricaoErro = obterDescricaoErro(validacao.erro);
                updateStmt.run(0, descricaoErro, dataValidacao, marco.id);
                estatisticas.invalidos++;

                estatisticas.detalhes.push({
                    id: marco.id,
                    codigo: marco.codigo,
                    tipo: marco.tipo,
                    erro: validacao.erro,
                    descricao: descricaoErro,
                    coordenada_e: marco.coordenada_e,
                    coordenada_n: marco.coordenada_n
                });
            }
        }
    });

    transaction(marcos);

    estatisticas.tempo_ms = Date.now() - inicio;

    return estatisticas;
}

module.exports = {
    validarCoordenadaUTM,
    validarCoordenadaLatLng,
    converterUTMparaLatLng,
    validarMarco,
    validarTodosMarcos,
    obterDescricaoErro
};
