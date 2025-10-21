// ============================================
// BUSCA POR RAIO - POSTGIS
// ============================================
// Funcionalidade de busca geoespacial usando PostgreSQL + PostGIS

let circuloBusca = null;

/**
 * Busca marcos num raio específico usando PostGIS
 * @param {number} lat - Latitude do centro
 * @param {number} lng - Longitude do centro
 * @param {number} raioKm - Raio em quilômetros
 */
async function buscarPorRaio(lat, lng, raioKm) {
    try {
        console.log(`🔍 Buscando marcos num raio de ${raioKm}km...`);

        const raioMetros = raioKm * 1000;
        const response = await fetch(`${API_URL}/api/marcos/raio/${lat}/${lng}/${raioMetros}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        console.log(`✅ Encontrados ${result.total_encontrados} marcos em ${raioKm}km`);

        // Remover círculo anterior
        if (circuloBusca) {
            map.removeLayer(circuloBusca);
        }

        // Desenhar círculo no mapa
        circuloBusca = L.circle([lat, lng], {
            radius: raioMetros,
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 10'
        }).addTo(map);

        // Adicionar marcador no centro
        const centerMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background: #3388ff; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            })
        }).addTo(map);

        centerMarker.bindPopup(`
            <div style="text-align: center;">
                <strong>Centro da Busca</strong><br>
                Raio: ${raioKm}km<br>
                Encontrados: ${result.total_encontrados} marcos
            </div>
        `).openPopup();

        // Salvar referência para remover depois
        if (!circuloBusca._centerMarker) {
            circuloBusca._centerMarker = centerMarker;
        }

        // Centralizar no círculo
        map.fitBounds(circuloBusca.getBounds(), { padding: [50, 50] });

        // Exibir resultados
        exibirResultadosBusca(result.marcos, `Marcos num raio de ${raioKm}km`);

        // Mostrar toast
        showToast(`${result.total_encontrados} marcos encontrados em ${raioKm}km`, 'success');

        return result;

    } catch (error) {
        console.error('❌ Erro na busca por raio:', error);
        showToast('Erro ao buscar por raio. Verifique se a API PostgreSQL está rodando.', 'error');
    }
}

/**
 * Exibe os resultados da busca num painel lateral
 */
function exibirResultadosBusca(marcos, titulo) {
    // Remover painel anterior se existir
    const existente = document.getElementById('resultados-busca');
    if (existente) {
        existente.remove();
    }

    // Criar novo painel
    const div = document.createElement('div');
    div.id = 'resultados-busca';
    div.style.cssText = `
        position: absolute;
        top: 80px;
        right: 20px;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        max-width: 320px;
        max-height: 500px;
        overflow-y: auto;
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #3388ff;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">
                🎯 ${titulo}
            </h3>
            <button onclick="fecharResultadosBusca()"
                    style="border: none; background: none; cursor: pointer; font-size: 24px; color: #999; line-height: 1;">
                ×
            </button>
        </div>
        <p style="margin: 5px 0 10px 0; color: #666; font-size: 14px;">
            <strong>${marcos.length}</strong> marcos encontrados
        </p>
    `;

    if (marcos.length === 0) {
        html += `
            <div style="text-align: center; padding: 20px; color: #999;">
                <p>Nenhum marco encontrado neste raio</p>
            </div>
        `;
    } else {
        marcos.forEach((marco, index) => {
            const distanciaKm = marco.distancia_metros ? (marco.distancia_metros / 1000).toFixed(2) : '?';
            const corTipo = marco.tipo === 'V' ? '#84c225' : marco.tipo === 'M' ? '#5a9618' : '#9dd447';

            html += `
                <div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;"
                     onmouseover="this.style.background='#f8f9fa'"
                     onmouseout="this.style.background='white'"
                     onclick="localizarMarcoNoMapa('${marco.codigo}', ${marco.latitude}, ${marco.longitude})">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; color: ${corTipo}; font-size: 14px;">
                                ${marco.codigo}
                            </div>
                            <div style="font-size: 12px; color: #666; margin-top: 3px;">
                                <span style="background: ${corTipo}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 5px;">
                                    ${marco.tipo}
                                </span>
                                ${marco.municipio}
                            </div>
                        </div>
                        <div style="text-align: right; margin-left: 10px;">
                            <div style="font-size: 13px; font-weight: bold; color: #3388ff;">
                                ${distanciaKm} km
                            </div>
                            <div style="font-size: 10px; color: #999;">
                                distância
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    div.innerHTML = html;
    document.body.appendChild(div);
}

/**
 * Fecha o painel de resultados e remove o círculo do mapa
 */
function fecharResultadosBusca() {
    const container = document.getElementById('resultados-busca');
    if (container) {
        container.remove();
    }

    if (circuloBusca) {
        // Remover marcador do centro também
        if (circuloBusca._centerMarker) {
            map.removeLayer(circuloBusca._centerMarker);
        }
        map.removeLayer(circuloBusca);
        circuloBusca = null;
    }
}

/**
 * Localiza e destaca um marco específico no mapa
 */
function localizarMarcoNoMapa(codigo, lat, lng) {
    console.log(`📍 Localizando marco: ${codigo}`);

    // Fechar painel de resultados
    fecharResultadosBusca();

    // Centralizar no marco com zoom alto
    map.setView([lat, lng], 16);

    // Destacar temporariamente
    const highlight = L.circle([lat, lng], {
        radius: 50,
        color: '#ff6b6b',
        fillColor: '#ff6b6b',
        fillOpacity: 0.3,
        weight: 3
    }).addTo(map);

    // Remover destaque após 3 segundos
    setTimeout(() => {
        map.removeLayer(highlight);
    }, 3000);

    showToast(`Marco ${codigo} localizado`, 'success');
}

/**
 * Adiciona controle de busca por raio no mapa
 */
function adicionarControleBuscaRaio() {
    const controlDiv = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    controlDiv.style.cssText = `
        background: white;
        padding: 12px;
        cursor: default;
        min-width: 180px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;

    controlDiv.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; font-size: 14px; color: #333; display: flex; align-items: center; gap: 6px;">
            🔍 <span>Busca por Raio</span>
        </div>
        <div style="margin-bottom: 8px;">
            <label style="font-size: 12px; display: block; margin-bottom: 4px; color: #666;">
                Raio (km):
            </label>
            <input type="number" id="input-raio" value="5" min="0.1" max="100" step="0.5"
                   style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
        <button id="btn-buscar-raio"
                style="width: 100%; padding: 8px; background: #3388ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; transition: background 0.2s;">
            🎯 Buscar Aqui
        </button>
        <div style="margin-top: 10px; font-size: 11px; color: #999; line-height: 1.4;">
            Clique no botão para buscar marcos ao redor do centro atual do mapa
        </div>
    `;

    // Prevenir propagação de eventos
    L.DomEvent.disableClickPropagation(controlDiv);
    L.DomEvent.disableScrollPropagation(controlDiv);

    // Efeito hover no botão
    const btn = controlDiv.querySelector('#btn-buscar-raio');
    btn.addEventListener('mouseover', () => {
        btn.style.background = '#2563eb';
    });
    btn.addEventListener('mouseout', () => {
        btn.style.background = '#3388ff';
    });

    const control = L.Control.extend({
        options: {
            position: 'topright'
        },
        onAdd: function(mapa) {
            return controlDiv;
        }
    });

    map.addControl(new control());

    // Event listener do botão
    document.getElementById('btn-buscar-raio').addEventListener('click', () => {
        const raio = parseFloat(document.getElementById('input-raio').value);

        if (isNaN(raio) || raio <= 0) {
            showToast('Por favor, insira um raio válido', 'error');
            return;
        }

        const center = map.getCenter();
        buscarPorRaio(center.lat, center.lng, raio);
    });

    console.log('✅ Controle de busca por raio adicionado ao mapa');
}

// Verificar se showToast existe, senão criar versão básica
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    };
}

console.log('✅ Módulo de busca por raio carregado (PostgreSQL + PostGIS)');
