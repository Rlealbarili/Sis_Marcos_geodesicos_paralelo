// =========================================
// SISTEMA DE VISUALIZAÇÃO DE POLÍGONOS
// =========================================

// Camada de polígonos (usar variável global declarada em script.js)

// Estilos por tipo de propriedade
const estilosPropriedades = {
    'RURAL': {
        color: '#27ae60',
        fillColor: '#2ecc71',
        weight: 2,
        fillOpacity: 0.2,
        dashArray: null
    },
    'URBANA': {
        color: '#3498db',
        fillColor: '#5dade2',
        weight: 2,
        fillOpacity: 0.2,
        dashArray: null
    },
    'INDUSTRIAL': {
        color: '#e67e22',
        fillColor: '#f39c12',
        weight: 2,
        fillOpacity: 0.2,
        dashArray: null
    },
    'COMERCIAL': {
        color: '#9b59b6',
        fillColor: '#bb8fce',
        weight: 2,
        fillOpacity: 0.2,
        dashArray: null
    }
};

async function carregarPropriedadesNoMapa() {
    try {
        console.log('📍 Carregando propriedades com geometria no mapa...');

        const response = await fetch('http://localhost:3001/api/propriedades/geojson');
        const geojson = await response.json();

        console.log('📦 GeoJSON recebido:', geojson);

        if (!geojson || !geojson.features || geojson.features.length === 0) {
            console.log('ℹ️ Nenhuma propriedade com geometria encontrada');
            return;
        }

        // Remover camada anterior se existir
        if (propriedadesLayer) {
            map.removeLayer(propriedadesLayer);
        }

        // Criar nova camada de polígonos
        propriedadesLayer = L.geoJSON(geojson, {
            style: function(feature) {
                const tipo = feature.properties.tipo || 'RURAL';
                return estilosPropriedades[tipo] || estilosPropriedades['RURAL'];
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;

                // Calcular diferença de área
                let diffArea = 'N/A';
                if (props.area_m2 && props.area_calculada) {
                    const diff = Math.abs(props.area_m2 - props.area_calculada);
                    const percent = (diff / props.area_m2) * 100;
                    diffArea = percent.toFixed(1) + '%';
                }

                // Criar popup
                const popupContent = `
                    <div style="min-width: 280px; font-family: system-ui, sans-serif;">
                        <h3 style="margin: 0 0 12px 0; color: #2c3e50; font-size: 16px; font-weight: 600;">
                            ${props.nome_propriedade}
                        </h3>

                        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 6px 0; color: #666;"><strong>Matrícula:</strong></td>
                                <td style="padding: 6px 0; text-align: right;">${props.matricula || 'N/A'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 6px 0; color: #666;"><strong>Cliente:</strong></td>
                                <td style="padding: 6px 0; text-align: right;">${props.cliente_nome || 'N/A'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 6px 0; color: #666;"><strong>Tipo:</strong></td>
                                <td style="padding: 6px 0; text-align: right;">
                                    <span style="background: ${estilosPropriedades[props.tipo].fillColor}; padding: 2px 8px; border-radius: 4px; color: white; font-size: 11px; font-weight: 500;">
                                        ${props.tipo}
                                    </span>
                                </td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 6px 0; color: #666;"><strong>Município:</strong></td>
                                <td style="padding: 6px 0; text-align: right;">${props.municipio || 'N/A'} - ${props.uf || ''}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 6px 0; color: #666;"><strong>Área informada:</strong></td>
                                <td style="padding: 6px 0; text-align: right;">
                                    ${props.area_m2 ? props.area_m2.toLocaleString('pt-BR') + ' m²' : 'N/A'}
                                    ${props.area_m2 ? ' (' + (props.area_m2/10000).toFixed(2) + ' ha)' : ''}
                                </td>
                            </tr>
                            ${props.area_calculada ? `
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 6px 0; color: #666;"><strong>Área calculada:</strong></td>
                                <td style="padding: 6px 0; text-align: right;">
                                    ${props.area_calculada.toLocaleString('pt-BR')} m²
                                    (${(props.area_calculada/10000).toFixed(2)} ha)
                                </td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 6px 0; color: #666;"><strong>Diferença:</strong></td>
                                <td style="padding: 6px 0; text-align: right; color: ${parseFloat(diffArea) > 5 ? '#e74c3c' : '#27ae60'}; font-weight: 500;">
                                    ${diffArea}
                                </td>
                            </tr>
                            ` : ''}
                            ${props.perimetro_calculado ? `
                            <tr>
                                <td style="padding: 6px 0; color: #666;"><strong>Perímetro:</strong></td>
                                <td style="padding: 6px 0; text-align: right;">
                                    ${props.perimetro_calculado.toFixed(2)} m
                                </td>
                            </tr>
                            ` : ''}
                        </table>

                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0; display: flex; gap: 8px;">
                            <button onclick="zoomParaPropriedade(${props.id})" style="flex: 1; padding: 8px 12px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.2s;">
                                🔍 Zoom
                            </button>
                            <button onclick="editarPropriedade(${props.id})" style="flex: 1; padding: 8px 12px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.2s;">
                                ✏️ Editar
                            </button>
                        </div>
                    </div>
                `;

                layer.bindPopup(popupContent, {
                    maxWidth: 350,
                    className: 'propriedade-popup'
                });

                // Eventos de mouse
                layer.on({
                    mouseover: function(e) {
                        const layer = e.target;
                        layer.setStyle({
                            weight: 3,
                            fillOpacity: 0.4
                        });
                    },
                    mouseout: function(e) {
                        propriedadesLayer.resetStyle(e.target);
                    },
                    click: function(e) {
                        console.log('🏠 Propriedade clicada:', props);
                        map.fitBounds(e.target.getBounds(), {
                            padding: [50, 50],
                            maxZoom: 16
                        });
                    }
                });
            }
        });

        // Adicionar ao mapa
        propriedadesLayer.addTo(map);

        console.log(`✅ ${geojson.features.length} propriedades adicionadas ao mapa`);

        // Fazer zoom para mostrar todas as propriedades
        if (geojson.features.length > 0) {
            const bounds = propriedadesLayer.getBounds();
            map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 15
            });
        }

    } catch (error) {
        console.error('❌ Erro ao carregar propriedades no mapa:', error);
    }
}

function zoomParaPropriedade(propriedadeId) {
    if (!propriedadesLayer) {
        console.warn('Camada de propriedades não está carregada');
        return;
    }

    propriedadesLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties.id === propriedadeId) {
            map.fitBounds(layer.getBounds(), {
                padding: [50, 50],
                maxZoom: 16
            });
            layer.openPopup();
        }
    });
}

function editarPropriedade(propriedadeId) {
    console.log('📝 Editar propriedade:', propriedadeId);
    // TODO: Implementar modal de edição
    alert(`Edição de propriedade ${propriedadeId} será implementada em breve`);
}

// Toggle para mostrar/ocultar propriedades
function togglePropriedadesPoligonos() {
    if (!propriedadesLayer) {
        console.log('ℹ️ Nenhuma propriedade carregada');
        return;
    }

    // Usar variável global se existir, caso contrário criar
    if (typeof window.propriedadesVisiveis === 'undefined') {
        window.propriedadesVisiveis = true;
    }

    if (window.propriedadesVisiveis) {
        map.removeLayer(propriedadesLayer);
        console.log('🚫 Polígonos ocultados');
    } else {
        map.addLayer(propriedadesLayer);
        console.log('✅ Polígonos exibidos');
    }
    window.propriedadesVisiveis = !window.propriedadesVisiveis;
}

// Expor funções globalmente
window.carregarPropriedadesNoMapa = carregarPropriedadesNoMapa;
window.zoomParaPropriedade = zoomParaPropriedade;
window.editarPropriedade = editarPropriedade;
window.togglePropriedadesPoligonos = togglePropriedadesPoligonos;

console.log('✅ Sistema de polígonos carregado');
console.log('💡 Use carregarPropriedadesNoMapa() para carregar polígonos');
console.log('💡 Use togglePropriedadesPoligonos() para mostrar/ocultar');
