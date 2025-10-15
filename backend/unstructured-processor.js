const proj4 = require('proj4');

class UnstructuredProcessor {
    constructor() {
        // Definir projeções manualmente com proj4 strings

        // SIRGAS 2000 - Geographic (Lat/Long)
        const sirgas2000Geo = '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs';

        // SIRGAS 2000 / UTM Zone 22S (usado no PR/SC)
        const sirgas2000UTM22S = '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

        this.sourceProjection = sirgas2000Geo;
        this.targetProjection = sirgas2000UTM22S;

        console.log('[Processor] Projeções configuradas manualmente:');
        console.log(`[Processor]   Source: SIRGAS 2000 Geographic`);
        console.log(`[Processor]   Target: SIRGAS 2000 UTM Zone 22S`);

        // ===== EXTRACTORS PARA VÉRTICES =====
        this.extractors = [
            // ===== PADRÃO 1: UTM URBANO COM ASPAS =====
            // Exemplo: marco 'V01' (E=672.338,25 m e N=7.187.922,29 m)
            // Exemplo: marco 'M01' (E=757919.735 m e N=7162638.648 m)
            {
                name: 'UTM_ASPAS_INLINE',
                type: 'UTM',
                regex: /(?:marco|MARCO|vértice|VÉRTICE)\s+['"']([^'"'\(\)]+?)['"']\s*(?:.*?)\(E\s*=?\s*([\d.,]+)\s*[mM]\s+[eE]\s+N\s*=?\s*([\d.,]+)\s*[mM]\)/gi
            },

            // ===== PADRÃO 2: UTM COM FHV- (RURAL) =====
            // Exemplo: marco FHV-M-3403 (E= 627.110,28 m e N= 7.097.954,68 m)
            // Exemplo: vértice FHV-P-8500 (E=627.606,53 m e N=7.097.428,25 m)
            {
                name: 'UTM_FHV_INLINE',
                type: 'UTM',
                regex: /(?:marco|MARCO|vértice|VÉRTICE)\s+(FHV-[MmPpVv]-\d+)\s*(?:.*?)\(E\s*=?\s*([\d.,]+)\s*[mM]\s+[eE]?\s+N\s*=?\s*([\d.,]+)\s*[mM]\)/gi
            },

            // ===== PADRÃO 3: LAT/LONG EM DMS (RURAL) =====
            // Exemplo: vértice FHV-M-0159 ... Longitude:-49°28'14,978", Latitude:-25°18'54,615"
            {
                name: 'GEO_DMS_LONGITUDE_FIRST',
                type: 'GEO',
                regex: /(?:vértice|VÉRTICE|marco|MARCO)\s+(FHV-[MmPpVv]-\d+|[A-Z0-9-]+)[\s\S]{0,300}?(?:LONGITUDE|Longitude)\s*:?\s*([-]?\d+[°º]\d+['"']\d+[,.]?\d*[""])\s*,?\s*(?:LATITUDE|Latitude)\s*:?\s*([-]?\d+[°º]\d+['"']\d+[,.]?\d*[""])/gi
            },

            // ===== PADRÃO 4: LAT/LONG EM DMS ALTERNATIVO =====
            // Exemplo: VÉRTICE V-001, DE COORDENADAS LAT 25°19'04,439"S, LONG 49°31'42,042"W
            {
                name: 'GEO_DMS_LAT_FIRST',
                type: 'GEO',
                regex: /(?:marco|vértice|MARCO|VÉRTICE)\s+([A-Z0-9-]+)\s*,?\s*DE\s+COORDENADAS\s+(?:LAT|LATITUDE)\s+([\d°'".,\s]+[NS])\s*,\s*(?:LONG|LONGITUDE)\s*:?\s*([\d°'".,\s]+[WEO])/gi
            },

            // ===== PADRÃO 5: UTM APÓS "ATÉ O MARCO" =====
            // Exemplo: até o marco 'V02' (E=672.395,08 m e N=7.187.911,77 m)
            {
                name: 'UTM_ATE_O_MARCO',
                type: 'UTM',
                regex: /até\s+o\s+(?:marco|MARCO|vértice|VÉRTICE)\s+['"']([^'"'\(\)]+?)['"']\s*\(E\s*=?\s*([\d.,]+)\s*[mM]\s+[eE]\s+N\s*=?\s*([\d.,]+)\s*[mM]\)/gi
            },

            // ===== PADRÃO 6: FHV APÓS "ATÉ O MARCO" =====
            // Exemplo: até o marco FHV-M-3489 (E=627.371,18 m e N=7.097.924,76 m)
            {
                name: 'UTM_FHV_ATE_O_MARCO',
                type: 'UTM',
                regex: /até\s+o\s+(?:marco|MARCO|vértice|VÉRTICE)\s+(FHV-[MmPpVv]-\d+)\s*\(E\s*=?\s*([\d.,]+)\s*[mM]\s+[eE]?\s+N\s*=?\s*([\d.,]+)\s*[mM]\)/gi
            }
        ];

        // ===== EXTRACTORS PARA METADADOS =====
        this.metadataExtractors = {
            // Matrícula (suporta múltiplos formatos)
            matricula: [
                /(?:MATRÍCULA|Matrícula|matrícula)\s+(?:n°|nº|N°|N|sob\s+o\s+n°)\s*([\d.,\s/]+)/i,
                /matriculad[oa]\s+sob\s+o?\s+n[°º]?\s*([\d.,\s/]+)/i
            ],

            // Imóvel/Propriedade
            imovel: [
                /IMÓVEL\s*:\s*([^\n]+)/i,
                /PROPRIEDADE\s*:\s*([^\n]+)/i
            ],

            // Proprietários (lista ou único)
            proprietarios: [
                /PROPRIETÁRIOS?\s*:\s*([\s\S]*?)(?=\n\s*\n|COMARCA|Comarca|MUNICÍPIO|Município)/i,
                /PROPRIETÁRIO\s*:\s*([^\n]+)/i,
                /de\s+propriedade\s+de\s+([^,;\.]+)/i
            ],

            // Comarca
            comarca: [
                /COMARCA\s*:\s*([^\n]+)/i,
                /Comarca\s*:\s*([^\n]+)/i
            ],

            // Município
            municipio: [
                /MUNICÍPIO\s*:\s*([^\n\s]+)/i,
                /Município\s*:\s*([^\n\s]+)/i,
                /município\s+de\s+([A-Za-zÀ-ÿ\s]+?)\s*[–\-—]\s*PR/i
            ],

            // UF
            uf: [
                /UF\s*:\s*([A-Z]{2})/i,
                /Estado\s+de\s+([A-Za-zÀ-ÿ\s]+)/i
            ],

            // Área (suporta m² e hectares)
            area: [
                /ÁREA(?:\s+SGL)?\s*:\s*([\d.,]+)\s*m²/i,
                /área\s+superficial\s+de\s+([\d.,]+)\s*m²/i,
                /ÁREA\s*:\s*([\d.,]+)\s*ha/i
            ],

            // Perímetro
            perimetro: [
                /PERÍMETRO(?:\s+SGL|\s*\(m\))?\s*:\s*([\d.,]+)\s*m/i,
                /perímetro\s+de\s+([\d.,]+)\s*m/i
            ]
        };
    }

    _normalizeText(text) {
        if (!text) return '';
        // Preserva caracteres especiais importantes (°, ', ")
        let normalized = text.toUpperCase();
        return normalized;
    }

    _normalizeCoordinate(coord) {
        // Detectar se o ponto é separador decimal ou de milhar
        // Se tem vírgula, o ponto é separador de milhar: 627.110,28 → 627110.28
        // Se não tem vírgula, o ponto é decimal: 757919.735 → 757919.735

        if (coord.includes(',')) {
            // Ponto é separador de milhar, vírgula é decimal
            return parseFloat(coord.replace(/\./g, '').replace(',', '.'));
        } else {
            // Ponto é decimal (já está no formato correto)
            return parseFloat(coord);
        }
    }

    _convertDMSToDD(coordString) {
        if (!coordString) {
            console.log(`[Processor]     ⚠️ DMS vazio ou null`);
            return null;
        }

        // Limpar string e remover aspas extras
        let cleaned = coordString.trim().replace(/[""]+$/g, '"'); // Remove aspas duplas extras no final

        console.log(`[Processor]     Input DMS: "${coordString}"`);
        console.log(`[Processor]     Cleaned DMS: "${cleaned}"`);

        // Verificar se já é decimal
        const decimalMatch = cleaned.match(/^([-]?\d+[.,]\d+)$/);
        if (decimalMatch) {
            const decimal = parseFloat(decimalMatch[1].replace(',', '.'));
            console.log(`[Processor]     ✅ Decimal direto: ${cleaned} → ${decimal}`);
            return decimal;
        }

        // Parse DMS - REGEX MELHORADO
        // Suporta: -49°28'14,978" ou -49°28'14.978" ou 49°28'14,978"S
        const dmsMatch = cleaned.match(/([-]?\d+)[°º]\s*(\d+)['"'′]\s*([\d.,]+)["″"']?\s*([NSWEOL])?/i);

        if (!dmsMatch) {
            console.log(`[Processor]     ❌ Regex DMS falhou para: "${cleaned}"`);
            return null;
        }

        const [fullMatch, deg, min, sec, dir] = dmsMatch;

        console.log(`[Processor]     DMS grupos: deg="${deg}", min="${min}", sec="${sec}", dir="${dir || 'none'}"`);

        // Converter segundos (trocar vírgula por ponto)
        const secFloat = parseFloat(sec.replace(',', '.'));

        if (isNaN(secFloat)) {
            console.log(`[Processor]     ❌ Segundos inválidos: "${sec}"`);
            return null;
        }

        let decimal = Math.abs(parseFloat(deg)) +
                     (parseFloat(min) / 60) +
                     (secFloat / 3600);

        // Aplicar sinal baseado na direção ou sinal do grau
        if (parseFloat(deg) < 0 || ['S', 'W', 'O'].includes(dir?.toUpperCase())) {
            decimal = -decimal;
        }

        console.log(`[Processor]     ✅ DMS convertido: ${cleaned} → ${decimal.toFixed(8)}`);

        return decimal;
    }

    _extractMetadata(textoCompleto) {
        const metadata = {};

        for (const [campo, regexArray] of Object.entries(this.metadataExtractors)) {
            const regexList = Array.isArray(regexArray) ? regexArray : [regexArray];

            for (const regex of regexList) {
                const match = textoCompleto.match(regex);
                if (match) {
                    if (campo === 'proprietarios') {
                        const proprietariosTexto = match[1];
                        const proprietarios = proprietariosTexto
                            .split(/\n/)
                            .map(p => p.trim())
                            .filter(p => p.length > 3 &&
                                       !p.match(/^[:\-_]+$/) &&
                                       !p.match(/^(COMARCA|MUNICÍPIO|ÁREA|PERÍMETRO)/i));
                        metadata[campo] = proprietarios;
                    } else if (campo === 'area') {
                        let valor = this._normalizeCoordinate(match[1]);
                        // Se está em hectares, converter para m²
                        if (textoCompleto.match(/ÁREA\s*:\s*[\d.,]+\s*ha/i)) {
                            valor = valor * 10000;
                        }
                        metadata[campo] = valor;
                    } else if (campo === 'perimetro') {
                        metadata[campo] = this._normalizeCoordinate(match[1]);
                    } else if (campo === 'uf') {
                        // Extrair sigla do estado
                        const ufTexto = match[1];
                        const ufMap = {
                            'PARANÁ': 'PR', 'PARANA': 'PR',
                            'SANTA CATARINA': 'SC',
                            'SÃO PAULO': 'SP', 'SAO PAULO': 'SP'
                        };
                        metadata[campo] = ufMap[ufTexto.toUpperCase()] || ufTexto.substring(0, 2).toUpperCase();
                    } else {
                        metadata[campo] = match[1].trim();
                    }
                    break; // Encontrou, para de testar regex para este campo
                }
            }
        }

        return metadata;
    }

    _isValidCoordinate(e, n, tipo) {
        if (tipo === 'UTM') {
            // UTM Zone 22S absoluto: E=600k-800k, N=7M-7.5M
            const isAbsoluteUTM = (e >= 600000 && e <= 800000 && n >= 7000000 && n <= 7500000);

            // Coordenadas locais: E<100k, N<100k
            const isLocalCoord = (e < 100000 && n < 100000);

            // UTM válido mas fora da Zone 22S (aceitar outras zonas)
            const isOtherUTM = (e >= 100000 && e <= 900000 && n >= 1000000 && n <= 10000000);

            return isAbsoluteUTM || isLocalCoord || isOtherUTM;
        }

        if (tipo === 'GEO') {
            // Latitude: -90 a +90
            // Longitude: -180 a +180
            const validLat = (n >= -90 && n <= 90);
            const validLon = (e >= -180 && e <= 180);
            return validLat && validLon;
        }

        return false;
    }

    processUnstructuredResponse(elements) {
        console.log(`[Processor] Recebidos ${elements.length} elementos do Unstructured.`);

        // Juntar todo o texto
        const textoCompleto = elements.map(el => el.text).join('\n');
        const textoNormalizado = this._normalizeText(textoCompleto);

        console.log('[Processor] ====================================');
        console.log('[Processor] INICIANDO EXTRAÇÃO - VERSÃO 2');
        console.log('[Processor] ====================================');

        // ===== EXTRAÇÃO DE METADADOS =====
        console.log('[Processor] [1/2] Extraindo metadados...');
        const metadata = this._extractMetadata(textoCompleto);
        console.log('[Processor] Metadados encontrados:', Object.keys(metadata).length);
        for (const [key, value] of Object.entries(metadata)) {
            if (Array.isArray(value)) {
                console.log(`[Processor]   - ${key}: [${value.length} itens]`);
            } else {
                console.log(`[Processor]   - ${key}: ${value}`);
            }
        }

        // ===== EXTRAÇÃO DE VÉRTICES =====
        console.log('[Processor] [2/2] Extraindo vértices...');
        const vertices = [];
        const verticesEncontrados = new Set();
        let totalMatches = 0;

        for (const extractor of this.extractors) {
            extractor.regex.lastIndex = 0;

            let match;
            let countExtractor = 0;

            while ((match = extractor.regex.exec(textoNormalizado)) !== null) {
                totalMatches++;
                countExtractor++;

                try {
                    let vertex;

                    if (extractor.type === 'UTM') {
                        const nome = match[1].trim();
                        let e = this._normalizeCoordinate(match[2]);
                        let n = this._normalizeCoordinate(match[3]);

                        if (!this._isValidCoordinate(e, n, 'UTM')) {
                            console.log(`[Processor]   ⚠️ Coord inválida: ${nome} (E=${e}, N=${n})`);
                            continue;
                        }

                        const coordTipo = (e > 100000 && n > 1000000) ? 'UTM' : 'LOCAL';

                        vertex = {
                            nome: nome,
                            coordenadas: {
                                tipo: coordTipo,
                                e: e,
                                n: n
                            }
                        };

                    } else if (extractor.type === 'GEO') {
                        const nome = match[1] ? match[1].trim() : 'UNKNOWN';

                        // Validar que temos todos os grupos de captura
                        if (!match[2] || !match[3]) {
                            console.log(`[Processor]   ⚠️ Match incompleto para ${nome}: match[2]=${match[2]}, match[3]=${match[3]}`);
                            continue;
                        }

                        // Determinar ordem: lon/lat ou lat/lon
                        let lon, lat;
                        if (extractor.name === 'GEO_DMS_LONGITUDE_FIRST') {
                            console.log(`[Processor]     Convertendo: Lon="${match[2]}", Lat="${match[3]}"`);
                            lon = this._convertDMSToDD(match[2]);
                            lat = this._convertDMSToDD(match[3]);
                        } else {
                            console.log(`[Processor]     Convertendo: Lat="${match[2]}", Lon="${match[3]}"`);
                            lat = this._convertDMSToDD(match[2]);
                            lon = this._convertDMSToDD(match[3]);
                        }

                        if (lat === null || lon === null) {
                            console.log(`[Processor]   ⚠️ Falha na conversão DMS para ${nome}`);
                            console.log(`[Processor]       Lat resultado: ${lat}`);
                            console.log(`[Processor]       Lon resultado: ${lon}`);
                            continue;
                        }

                        console.log(`[Processor]     Lat/Lon válidos: lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}`);

                        if (!this._isValidCoordinate(lon, lat, 'GEO')) {
                            console.log(`[Processor]   ⚠️ Lat/Lon fora do range válido`);
                            continue;
                        }

                        // Converter para UTM
                        console.log(`[Processor]     Convertendo proj4: [${lon.toFixed(6)}, ${lat.toFixed(6)}] → UTM`);

                        let utm;
                        try {
                            utm = proj4(this.sourceProjection, this.targetProjection, [lon, lat]);

                            if (!utm || !Array.isArray(utm) || utm.length !== 2) {
                                console.log(`[Processor]     ❌ Proj4 retornou formato inválido:`, utm);
                                continue;
                            }

                            console.log(`[Processor]     Resultado UTM: E=${utm[0].toFixed(2)}, N=${utm[1].toFixed(2)}`);
                        } catch (error) {
                            console.log(`[Processor]     ❌ Erro no proj4:`, error.message);
                            continue;
                        }

                        // Validar resultado da conversão
                        if (!this._isValidCoordinate(utm[0], utm[1], 'UTM')) {
                            console.log(`[Processor]     ⚠️ UTM convertido falhou validação: E=${utm[0]}, N=${utm[1]}`);
                            continue;
                        }

                        vertex = {
                            nome: nome,
                            coordenadas: {
                                tipo: 'UTM',
                                e: utm[0],
                                n: utm[1],
                                lat_original: lat,
                                lon_original: lon
                            }
                        };
                    }

                    // Evitar duplicatas
                    const chave = `${vertex.nome}-${vertex.coordenadas.e.toFixed(2)}-${vertex.coordenadas.n.toFixed(2)}`;
                    if (!verticesEncontrados.has(chave)) {
                        verticesEncontrados.add(chave);
                        vertices.push(vertex);
                        console.log(`[Processor]   ✅ ${vertex.nome} (${vertex.coordenadas.tipo}: E=${vertex.coordenadas.e.toFixed(2)}, N=${vertex.coordenadas.n.toFixed(2)})`);
                    }

                } catch (error) {
                    console.error(`[Processor]   ❌ Erro ao processar match:`, error.message);
                }
            }

            if (countExtractor > 0) {
                console.log(`[Processor] Padrão '${extractor.name}': ${countExtractor} matches`);
            }
        }

        console.log('[Processor] ====================================');
        console.log(`[Processor] EXTRAÇÃO CONCLUÍDA`);
        console.log(`[Processor] Total matches testados: ${totalMatches}`);
        console.log(`[Processor] Vértices únicos extraídos: ${vertices.length}`);
        console.log('[Processor] ====================================');

        return {
            metadata,
            vertices,
            estatisticas: {
                total_matches: totalMatches,
                vertices_unicos: vertices.length,
                metadados_extraidos: Object.keys(metadata).length
            }
        };
    }
}

module.exports = UnstructuredProcessor;
