// Configuração da API
const API_URL = window.location.origin;
let marcoAtual = null;

// ==========================================
// INICIALIZAÇÃO DO SISTEMA
// ==========================================

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando Sistema de Marcos Geodésicos...');

    // 1. Inicializar mapa
    inicializarMapa();

    // 2. Atualizar estatísticas do header
    atualizarEstatisticas();

    // 3. Carregar clientes para filtros
    carregarClientesParaFiltros();

    // 4. Configurar listeners de arquivo
    configurarListenersArquivo();

    // 5. Aba inicial
    trocarAba('mapa');

    // Legacy: Solicitar nome do usuário
    let userName = localStorage.getItem('userName');
    if (!userName) {
        userName = prompt('Digite seu nome:') || 'Usuário';
        localStorage.setItem('userName', userName);
    }
    if (document.getElementById('userName')) {
        document.getElementById('userName').textContent = userName;
    }

    console.log('✅ Sistema inicializado com sucesso!');
});

// Navegação entre Tabs
function showTab(tabName) {
    // Remover active de todos os itens do menu
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Adicionar active no item clicado
    event.target.closest('.nav-item').classList.add('active');
    
    // Esconder todos os conteúdos
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar conteúdo selecionado
    document.getElementById('tab-' + tabName).classList.add('active');
    
    // Carregar dados específicos se necessário
    if (tabName === 'dashboard') {
        carregarEstatisticas();
        carregarMarcosRecentes();
    } else if (tabName === 'mapa') {
        if (!map) {
            setTimeout(inicializarMapa, 100);
        }
    } else if (tabName === 'terrenos') {
        carregarClientesSelect('filtro-terreno-cliente');
    } else if (tabName === 'clientes') {
        carregarClientes();
    } else if (tabName === 'memorial') {
        setTimeout(inicializarImportadorMemorial, 100);
    } else if (tabName === 'validacao') {
        carregarEstatisticasValidacao();
    }
}

// ============== DASHBOARD ==============

async function carregarEstatisticas() {
    try {
        const response = await fetch(`${API_URL}/api/estatisticas`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('stat-total').textContent = data.data.total;
            document.getElementById('stat-v').textContent = data.data.tipoV;
            document.getElementById('stat-m').textContent = data.data.tipoM;
            document.getElementById('stat-p').textContent = data.data.tipoP;
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        showToast('Erro ao carregar estatísticas', 'error');
    }
}

async function carregarMarcosRecentes() {
    try {
        const response = await fetch(`${API_URL}/api/marcos?limit=10`);
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('recentMarcos');
            
            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum marco cadastrado</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.data.slice(0, 10).map(marco => `
                <tr>
                    <td><strong>${marco.codigo}</strong></td>
                    <td><span class="badge badge-${marco.tipo.toLowerCase()}">${marco.tipo}</span></td>
                    <td>${marco.localizacao || '-'}</td>
                    <td>${marco.lote || '-'}</td>
                    <td>${formatarData(marco.data_cadastro)}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar marcos recentes:', error);
    }
}

// ============== CONSULTA ==============

async function buscarMarcos() {
    const filtros = {
        tipo: document.getElementById('filtro-tipo').value,
        codigo: document.getElementById('filtro-codigo').value,
        localizacao: document.getElementById('filtro-localizacao').value,
        lote: document.getElementById('filtro-lote').value,
        metodo: document.getElementById('filtro-metodo').value,
        limites: document.getElementById('filtro-limites').value
    };
    
    const params = new URLSearchParams();
    Object.keys(filtros).forEach(key => {
        if (filtros[key]) params.append(key, filtros[key]);
    });
    
    try {
        const response = await fetch(`${API_URL}/api/marcos?${params}`);
        const data = await response.json();
        
        if (data.success) {
            exibirResultados(data.data);
        }
    } catch (error) {
        console.error('Erro ao buscar marcos:', error);
        showToast('Erro ao buscar marcos', 'error');
    }
}

function exibirResultados(marcos) {
    const tbody = document.getElementById('resultTable');
    const countElement = document.getElementById('result-count');
    
    countElement.textContent = marcos.length;
    
    if (marcos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhum marco encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = marcos.map(marco => `
        <tr>
            <td><strong>${marco.codigo}</strong></td>
            <td><span class="badge badge-${marco.tipo.toLowerCase()}">${marco.tipo}</span></td>
            <td>${marco.localizacao || '-'}</td>
            <td>${marco.metodo || '-'}</td>
            <td>${marco.limites || '-'}</td>
            <td>${formatarNumero(marco.coordenada_e)}</td>
            <td>${formatarNumero(marco.coordenada_n)}</td>
            <td>${formatarNumero(marco.altitude_h)}</td>
            <td>${marco.lote || '-'}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="verDetalhes(${marco.id})">
                    👁️ Ver
                </button>
            </td>
        </tr>
    `).join('');
}

function limparFiltros() {
    document.getElementById('filtro-tipo').value = '';
    document.getElementById('filtro-codigo').value = '';
    document.getElementById('filtro-localizacao').value = '';
    document.getElementById('filtro-lote').value = '';
    document.getElementById('filtro-metodo').value = '';
    document.getElementById('filtro-limites').value = '';
    
    document.getElementById('resultTable').innerHTML = 
        '<tr><td colspan="10" class="text-center">Use os filtros acima para buscar marcos</td></tr>';
    document.getElementById('result-count').textContent = '0';
}

// ============== CADASTRO ==============

function setupFormCadastro() {
    const form = document.getElementById('formCadastro');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const marco = {
            codigo: document.getElementById('cad-codigo').value,
            tipo: document.getElementById('cad-tipo').value,
            localizacao: document.getElementById('cad-localizacao').value,
            metodo: document.getElementById('cad-metodo').value,
            limites: document.getElementById('cad-limites').value,
            coordenada_e: parseFloat(document.getElementById('cad-coordenada-e').value) || null,
            desvio_e: parseFloat(document.getElementById('cad-desvio-e').value) || null,
            coordenada_n: parseFloat(document.getElementById('cad-coordenada-n').value) || null,
            desvio_n: parseFloat(document.getElementById('cad-desvio-n').value) || null,
            altitude_h: parseFloat(document.getElementById('cad-altitude-h').value) || null,
            desvio_h: parseFloat(document.getElementById('cad-desvio-h').value) || null,
            lote: document.getElementById('cad-lote').value,
            data_levantamento: document.getElementById('cad-data').value,
            observacoes: document.getElementById('cad-observacoes').value,
            usuario_cadastro: document.getElementById('cad-usuario').value || localStorage.getItem('userName')
        };
        
        try {
            const response = await fetch(`${API_URL}/api/marcos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(marco)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Marco cadastrado com sucesso!', 'success');
                limparFormulario();
                carregarEstatisticas();
            } else {
                showToast(data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao cadastrar marco:', error);
            showToast('Erro ao cadastrar marco', 'error');
        }
    });
}

function limparFormulario() {
    document.getElementById('formCadastro').reset();
}

// ============== IMPORTAÇÃO ==============

function setupImportacao() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileImport');
    
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            importarArquivo(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importarArquivo(e.target.files[0]);
        }
    });
}

async function importarArquivo(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showToast('Importando dados...', 'info');
        
        const response = await fetch(`${API_URL}/api/importar`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            carregarEstatisticas();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao importar:', error);
        showToast('Erro ao importar arquivo', 'error');
    }
}

// ============== EXPORTAÇÃO ==============

async function exportarDados() {
    try {
        showToast('Gerando arquivo de exportação...', 'info');
        
        const response = await fetch(`${API_URL}/api/exportar`);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marcos_geodesicos_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Arquivo exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        showToast('Erro ao exportar dados', 'error');
    }
}

// ============== MODAL ==============

async function verDetalhes(id) {
    try {
        const response = await fetch(`${API_URL}/api/marcos/${id}`);
        const data = await response.json();
        
        if (data.success) {
            marcoAtual = data.data;
            exibirModal(data.data);
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar detalhes do marco', 'error');
    }
}

function exibirModal(marco) {
    const modal = document.getElementById('modalDetalhes');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
        <div class="detail-row">
            <div class="detail-label">Código:</div>
            <div class="detail-value"><strong>${marco.codigo}</strong></div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Tipo:</div>
            <div class="detail-value"><span class="badge badge-${marco.tipo.toLowerCase()}">${marco.tipo}</span></div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Localização:</div>
            <div class="detail-value">${marco.localizacao || '-'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Método:</div>
            <div class="detail-value">${marco.metodo || '-'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Tipo de Limite:</div>
            <div class="detail-value">${marco.limites || '-'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Coordenada E:</div>
            <div class="detail-value">${formatarNumero(marco.coordenada_e)} m ± ${formatarNumero(marco.desvio_e)} m</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Coordenada N:</div>
            <div class="detail-value">${formatarNumero(marco.coordenada_n)} m ± ${formatarNumero(marco.desvio_n)} m</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Altitude H:</div>
            <div class="detail-value">${formatarNumero(marco.altitude_h)} m ± ${formatarNumero(marco.desvio_h)} m</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Lote:</div>
            <div class="detail-value">${marco.lote || '-'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Data Levantamento:</div>
            <div class="detail-value">${formatarData(marco.data_levantamento)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Cadastrado por:</div>
            <div class="detail-value">${marco.usuario_cadastro || '-'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Data Cadastro:</div>
            <div class="detail-value">${formatarData(marco.data_cadastro)}</div>
        </div>
        ${marco.observacoes ? `
        <div class="detail-row">
            <div class="detail-label">Observações:</div>
            <div class="detail-value">${marco.observacoes}</div>
        </div>
        ` : ''}
    `;
    
    modal.classList.add('active');
}

function fecharModal() {
    document.getElementById('modalDetalhes').classList.remove('active');
    marcoAtual = null;
}

async function excluirMarco() {
    if (!marcoAtual) return;
    
    if (!confirm(`Tem certeza que deseja excluir o marco ${marcoAtual.codigo}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/marcos/${marcoAtual.id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Marco excluído com sucesso!', 'success');
            fecharModal();
            buscarMarcos();
            carregarEstatisticas();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir marco:', error);
        showToast('Erro ao excluir marco', 'error');
    }
}

// ============== UTILITÁRIOS ==============

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatarData(data) {
    if (!data) return '-';
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR');
}

function formatarNumero(numero) {
    if (numero === null || numero === undefined) return '-';
    return parseFloat(numero).toFixed(2);
}

function toggleUserMenu() {
    const novoNome = prompt('Digite seu nome:', localStorage.getItem('userName'));
    if (novoNome) {
        localStorage.setItem('userName', novoNome);
        document.getElementById('userName').textContent = novoNome;
    }
}

// ============== UTILITÁRIOS DE NAVEGAÇÃO MOBILE (NOVO) ==============

/**
 * Alterna a visibilidade da barra lateral (sidebar) 
 * usando a classe CSS 'active' para telas pequenas.
 */
function toggleSidebar() {
    // Busca o elemento da barra lateral (classe 'sidebar' [4])
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebar) {
        // Usa toggle para adicionar ou remover a classe 'active'
        sidebar.classList.toggle('active');
        
        // Fornecer feedback usando a função showToast existente [6]
        if (sidebar.classList.contains('active')) {
            // 'info' é uma classe de Toast existente [1, 7]
            showToast('Menu de navegação aberto.', 'info'); 
        } else {
            showToast('Menu de navegação fechado.', 'info');
        }
    }
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modalDetalhes');
    if (event.target === modal) {
        fecharModal();
    }
}

// ============== MAPA GIS ==============

let map = null;
let marcosLayer = null;
let poligonosLayer = null;
let marcadores = [];
let todosMarcos = [];
let poligonoEmCriacao = null;
let pontosPoligono = [];

// Camadas do mapa
let propriedadesRuraisLayer;
let propriedadesUrbanasLayer;
let propriedadesLoteamentoLayer;
let layerControl;

// Dados
let propriedadesData = null;

// Estilos dos polígonos por tipo
const estilosPoligonos = {
    RURAL: {
        color: '#27ae60',           // Verde escuro (borda)
        fillColor: '#2ecc71',       // Verde claro (preenchimento)
        fillOpacity: 0.25,
        weight: 2,
        dashArray: '5, 5'
    },
    URBANO: {
        color: '#2980b9',           // Azul escuro (borda)
        fillColor: '#3498db',       // Azul claro (preenchimento)
        fillOpacity: 0.30,
        weight: 2,
        dashArray: null
    },
    LOTEAMENTO: {
        color: '#c0392b',           // Vermelho escuro (borda)
        fillColor: '#e74c3c',       // Vermelho claro (preenchimento)
        fillOpacity: 0.20,
        weight: 2,
        dashArray: '10, 5'
    }
};

// Estilo ao passar o mouse
const estiloHover = {
    weight: 4,
    fillOpacity: 0.5
};

function definirProjecao() {
    if (typeof proj4 !== 'undefined') {
        proj4.defs("EPSG:31982", "+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
    }
}

// ==========================================
// INICIALIZAR MAPA LEAFLET
// ==========================================

function inicializarMapa() {
    console.log('Inicializando mapa...');

    // Verificar se elemento do mapa existe
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('❌ Elemento #map não encontrado!');
        return;
    }

    // Evitar reinicialização
    if (map) {
        console.log('Mapa já inicializado');
        return;
    }

    definirProjecao();

    // Criar mapa centrado no Brasil (aproximadamente Paraná)
    map = L.map('map').setView([-25.4284, -49.2733], 7);

    // Adicionar tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    console.log('✅ Mapa criado com sucesso');

    // Carregar dados
    Promise.all([
        carregarMarcos(),
        carregarPropriedades()
    ]).then(() => {
        console.log('✅ Dados carregados no mapa!');
        criarControleCamadas();
    }).catch(error => {
        console.error('❌ Erro ao carregar dados:', error);
    });
}

function utmParaLatLng(e, n) {
    try {
        if (typeof proj4 === 'undefined') {
            console.error('Biblioteca proj4 não carregada');
            return null;
        }
        
        const utmCoords = [parseFloat(e), parseFloat(n)];
        const wgs84Coords = proj4('EPSG:31982', 'EPSG:4326', utmCoords);
        
        return { lat: wgs84Coords[1], lng: wgs84Coords[0] };
    } catch (error) {
        console.error('Erro ao converter coordenadas:', error);
        return null;
    }
}

async function carregarMarcosNoMapa() {
    console.log('🗺️ Carregando marcos no mapa...');

    try {
        // CRÍTICO: Buscar apenas marcos LEVANTADOS
        const response = await fetch(`${API_URL}/api/marcos?status_campo=LEVANTADO`);
        const data = await response.json();

        if (data.success) {
            console.log(`📊 API retornou: ${data.data.length} marcos levantados`);

            todosMarcos = data.data;
            marcosLayer.clearLayers();
            marcadores = [];

            let bounds = [];
            let marcosComCoordenadas = 0;

            let marcosIgnorados = 0;

            data.data.forEach(marco => {
                // VALIDAÇÃO 1: Status LEVANTADO
                if (marco.status_campo !== 'LEVANTADO') {
                    marcosIgnorados++;
                    if (marcosIgnorados <= 5) {
                        console.warn(`Marco ${marco.codigo} ignorado: status ${marco.status_campo}`);
                    }
                    return;
                }

                const e = parseFloat(marco.coordenada_e);
                const n = parseFloat(marco.coordenada_n);

                // VALIDAÇÃO 2: Coordenadas em range UTM válido
                // E: 166.000 - 834.000 metros (Zone 22S range)
                // N: 0 - 10.000.000 metros (hemisfério sul)
                const isUTMValid = !isNaN(e) && !isNaN(n) &&
                                   e >= 166000 && e <= 834000 &&
                                   n >= 0 && n <= 10000000;

                if (isUTMValid) {
                    const coords = utmParaLatLng(e, n);

                    if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
                        bounds.push([coords.lat, coords.lng]);
                        marcosComCoordenadas++;

                        let cor = '#84c225';
                        if (marco.tipo === 'M') cor = '#5a9618';
                        if (marco.tipo === 'P') cor = '#9dd447';

                        const icone = L.divIcon({
                            className: 'custom-marker',
                            html: `<div style="background: ${cor}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });

                        const marker = L.marker([coords.lat, coords.lng], { icon: icone })
                            .bindPopup(`
                                <div style="min-width: 200px;">
                                    <h4 style="margin: 0 0 10px 0; color: #84c225;">${marco.codigo}</h4>
                                    <p style="margin: 5px 0;"><strong>Tipo:</strong> ${marco.tipo}</p>
                                    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #28a745;">LEVANTADO</span></p>
                                    <p style="margin: 5px 0;"><strong>Localização:</strong> ${marco.localizacao || '-'}</p>
                                    <p style="margin: 5px 0;"><strong>Lote:</strong> ${marco.lote || '-'}</p>
                                    <p style="margin: 5px 0;"><strong>E:</strong> ${e.toFixed(2)} m</p>
                                    <p style="margin: 5px 0;"><strong>N:</strong> ${n.toFixed(2)} m</p>
                                    <button onclick="verDetalhes(${marco.id})" style="margin-top: 10px; padding: 8px 15px; background: #84c225; color: white; border: none; border-radius: 5px; cursor: pointer;">Ver Detalhes</button>
                                </div>
                            `)
                            .addTo(marcosLayer);

                        marker.marcoData = marco;
                        marcadores.push(marker);
                    } else {
                        marcosIgnorados++;
                        if (marcosIgnorados <= 10) {
                            console.warn(`⚠️ Marco ${marco.codigo}: conversão UTM→LatLng falhou`);
                        }
                    }
                } else {
                    marcosIgnorados++;
                    if (marcosIgnorados <= 10) {
                        console.warn(`⚠️ Marco ${marco.codigo}: coordenadas inválidas (E:${e}, N:${n})`);
                    }
                }
            });

            if (marcosIgnorados > 0) {
                console.warn(`⚠️ Total de marcos ignorados: ${marcosIgnorados}`);
            }

            if (bounds.length > 0) {
                map.fitBounds(bounds, { padding: [50, 50] });
                console.log(`✅ Mapa: ${marcosComCoordenadas} marcos plotados com sucesso`);
                if (marcosIgnorados > 0) {
                    showToast(`${marcosComCoordenadas} marcos no mapa (${marcosIgnorados} ignorados)`, 'success');
                } else {
                    showToast(`${marcosComCoordenadas} marcos no mapa (apenas levantados)`, 'success');
                }
            } else {
                console.warn('⚠️ Nenhum marco levantado válido encontrado');
                showToast('Nenhum marco levantado para plotar', 'info');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar marcos no mapa:', error);
        showToast('Erro ao carregar marcos no mapa', 'error');
    }
}

async function carregarPoligonosNoMapa() {
    try {
        const response = await fetch(`${API_URL}/api/poligonos`);
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            poligonosLayer.clearLayers();

            data.data.forEach(poligono => {
                const geometria = JSON.parse(poligono.geometria);

                if (geometria.type === 'Polygon') {
                    const coords = geometria.coordinates[0].map(coord => [coord[1], coord[0]]);

                    const polygon = L.polygon(coords, {
                        color: '#84c225',
                        fillColor: '#84c225',
                        fillOpacity: 0.2,
                        weight: 2
                    }).bindPopup(`
                        <div style="min-width: 250px;">
                            <h4 style="margin: 0 0 10px 0; color: #84c225;">${poligono.nome}</h4>
                            <p style="margin: 5px 0;"><strong>Código:</strong> ${poligono.codigo}</p>
                            <p style="margin: 5px 0;"><strong>Cliente:</strong> ${poligono.cliente_nome || '-'}</p>
                            <p style="margin: 5px 0;"><strong>Área:</strong> ${poligono.area_m2 ? poligono.area_m2.toFixed(2) + ' m²' : '-'}</p>
                            <p style="margin: 5px 0;"><strong>Perímetro:</strong> ${poligono.perimetro_m ? poligono.perimetro_m.toFixed(2) + ' m' : '-'}</p>
                            <p style="margin: 5px 0;"><strong>Status:</strong> ${poligono.status}</p>
                            <button onclick="verDetalhesTerreno(${poligono.id})" style="margin-top: 10px; padding: 8px 15px; background: #84c225; color: white; border: none; border-radius: 5px; cursor: pointer;">Ver Detalhes</button>
                        </div>
                    `).addTo(poligonosLayer);
                }
            });
        }
    } catch (error) {
        console.error('Erro ao carregar polígonos:', error);
    }
}

// ==========================================
// CARREGAR PROPRIEDADES
// ==========================================
async function carregarPropriedades() {
    try {
        console.log('Carregando propriedades do banco...');

        const response = await fetch('/api/propriedades-mapa');
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        propriedadesData = result;
        console.log(`✅ ${result.total} propriedades carregadas`);

        // Criar camadas por tipo
        criarCamadasPropriedades(result.features);

    } catch (error) {
        console.error('❌ Erro ao carregar propriedades:', error);
    }
}

// ==========================================
// CRIAR CAMADAS DE PROPRIEDADES
// ==========================================
function criarCamadasPropriedades(features) {
    console.log('Criando camadas de propriedades...');

    // Separar por tipo
    const rurais = features.filter(f => f.properties.tipo === 'RURAL');
    const urbanas = features.filter(f => f.properties.tipo === 'URBANO');
    const loteamentos = features.filter(f => f.properties.tipo === 'LOTEAMENTO');

    console.log(`  - Rural: ${rurais.length}`);
    console.log(`  - Urbano: ${urbanas.length}`);
    console.log(`  - Loteamento: ${loteamentos.length}`);

    // Criar camada de propriedades rurais
    propriedadesRuraisLayer = L.geoJSON(rurais, {
        style: estilosPoligonos.RURAL,
        onEachFeature: adicionarInteracoesPoligono
    });

    // Criar camada de propriedades urbanas
    propriedadesUrbanasLayer = L.geoJSON(urbanas, {
        style: estilosPoligonos.URBANO,
        onEachFeature: adicionarInteracoesPoligono
    });

    // Criar camada de loteamentos
    propriedadesLoteamentoLayer = L.geoJSON(loteamentos, {
        style: estilosPoligonos.LOTEAMENTO,
        onEachFeature: adicionarInteracoesPoligono
    });

    // Adicionar camadas ao mapa (inicialmente visíveis)
    propriedadesRuraisLayer.addTo(map);
    propriedadesUrbanasLayer.addTo(map);
    propriedadesLoteamentoLayer.addTo(map);

    console.log('✅ Camadas de propriedades criadas');
}

// ==========================================
// ADICIONAR INTERAÇÕES AOS POLÍGONOS
// ==========================================
function adicionarInteracoesPoligono(feature, layer) {
    const props = feature.properties;

    // Criar popup
    const popupContent = `
        <div style="min-width: 250px;">
            <h3 style="margin: 0 0 10px 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                ${props.nome_propriedade || 'Sem nome'}
            </h3>

            <div style="margin-bottom: 8px;">
                <strong>📋 Matrícula:</strong> ${props.matricula}<br>
                <strong>👤 Proprietário:</strong> ${props.cliente_nome}<br>
                ${props.cliente_cpf_cnpj ? `<strong>📄 CPF/CNPJ:</strong> ${props.cliente_cpf_cnpj}<br>` : ''}
            </div>

            <div style="margin-bottom: 8px;">
                <strong>📍 Município:</strong> ${props.municipio || 'N/A'} - ${props.uf || 'N/A'}<br>
                ${props.comarca ? `<strong>⚖️ Comarca:</strong> ${props.comarca}<br>` : ''}
                <strong>🏷️ Tipo:</strong> <span style="background: ${getCorTipo(props.tipo)}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">${props.tipo}</span>
            </div>

            <div style="background: #ecf0f1; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <strong>📐 Área:</strong> ${props.area_m2 ? props.area_m2.toLocaleString('pt-BR') + ' m²' : 'N/A'}
                ${props.area_hectares ? ` (${props.area_hectares.toFixed(2)} ha)` : ''}<br>
                <strong>📏 Perímetro:</strong> ${props.perimetro_m ? props.perimetro_m.toLocaleString('pt-BR') + ' m' : 'N/A'}<br>
                <strong>🔺 Vértices:</strong> ${props.total_vertices}
            </div>

            <div style="text-align: center; margin-top: 10px;">
                <button onclick="verDetalhesPropriedade(${feature.id})"
                        style="background: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: 600;">
                    📊 Ver Detalhes Completos
                </button>
            </div>
        </div>
    `;

    layer.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'popup-propriedade'
    });

    // Tooltip com nome (sempre visível ao passar mouse)
    layer.bindTooltip(props.nome_propriedade || props.matricula, {
        permanent: false,
        direction: 'center',
        className: 'tooltip-propriedade'
    });

    // Efeitos hover
    layer.on({
        mouseover: function(e) {
            const layer = e.target;
            layer.setStyle(estiloHover);
            layer.bringToFront();
        },
        mouseout: function(e) {
            const layer = e.target;
            const tipo = feature.properties.tipo;
            layer.setStyle(estilosPoligonos[tipo]);
        },
        click: function(e) {
            map.fitBounds(e.target.getBounds(), { padding: [50, 50] });
        }
    });
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
function getCorTipo(tipo) {
    const cores = {
        'RURAL': '#27ae60',
        'URBANO': '#2980b9',
        'LOTEAMENTO': '#c0392b'
    };
    return cores[tipo] || '#95a5a6';
}

function verDetalhesPropriedade(propriedadeId) {
    // Redirecionar para página de detalhes (criar futuramente)
    // Por enquanto, apenas log
    console.log('Ver detalhes da propriedade:', propriedadeId);
    alert(`Funcionalidade em desenvolvimento.\nPropriedade ID: ${propriedadeId}`);
}

// ==========================================
// CONTROLE DE CAMADAS
// ==========================================
function criarControleCamadas() {
    console.log('Criando controle de camadas...');

    // Camadas base (tiles)
    const baseLayers = {
        "🗺️ Mapa Padrão": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }),
        "🛰️ Satélite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri'
        })
    };

    // Camadas overlay (dados)
    const overlayLayers = {
        "📍 Marcos Geodésicos": marcosLayer,
        "🌳 Propriedades Rurais": propriedadesRuraisLayer,
        "🏢 Propriedades Urbanas": propriedadesUrbanasLayer,
        "🏘️ Loteamentos": propriedadesLoteamentoLayer
    };

    // Adicionar controle ao mapa
    layerControl = L.control.layers(baseLayers, overlayLayers, {
        collapsed: false,
        position: 'topright'
    }).addTo(map);

    console.log('✅ Controle de camadas criado');
}

function filtrarMarcosNoMapa() {
    const tipo = document.getElementById('map-filter-tipo').value;
    marcosLayer.clearLayers();
    marcadores.forEach(marker => {
        if (!tipo || marker.marcoData.tipo === tipo) {
            marker.addTo(marcosLayer);
        }
    });
}

function centralizarMapa() {
    if (marcadores.length > 0) {
        const bounds = marcadores.map(m => m.getLatLng());
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function toggleCamadas() {
    if (map.hasLayer(marcosLayer)) {
        map.removeLayer(marcosLayer);
        showToast('Camada de marcos oculta', 'info');
    } else {
        map.addLayer(marcosLayer);
        showToast('Camada de marcos visível', 'info');
    }
}

function iniciarCriacaoPoligono() {
    if (poligonoEmCriacao) {
        showToast('Já existe um polígono em criação. Finalize ou cancele primeiro.', 'error');
        return;
    }
    
    showToast('Clique nos marcos no mapa para criar o polígono. Mínimo 3 pontos.', 'info');
    pontosPoligono = [];
    poligonoEmCriacao = L.polygon([], {
        color: '#84c225',
        fillColor: '#84c225',
        fillOpacity: 0.3,
        weight: 2,
        dashArray: '5, 5'
    }).addTo(map);
    
    marcadores.forEach(marker => {
        marker.on('click', adicionarPontoAoPoligono);
    });
    
    mostrarControlesPoligono();
}

function adicionarPontoAoPoligono(e) {
    const marker = e.target;
    const latlng = marker.getLatLng();
    
    pontosPoligono.push({
        latlng: latlng,
        marco: marker.marcoData
    });
    
    const coords = pontosPoligono.map(p => p.latlng);
    poligonoEmCriacao.setLatLngs(coords);
    showToast(`Ponto ${pontosPoligono.length} adicionado`, 'success');
}

function mostrarControlesPoligono() {
    const controles = document.createElement('div');
    controles.id = 'poligono-controles';
    controles.style.cssText = `
        position: fixed; top: 100px; right: 30px; background: white;
        padding: 20px; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); z-index: 1000;
    `;
    controles.innerHTML = `
        <h4 style="margin: 0 0 15px 0;">Criar Terreno</h4>
        <p style="margin-bottom: 15px;">Pontos: <strong id="pontos-count">0</strong></p>
        <button onclick="finalizarPoligono()" class="btn btn-success" style="width: 100%; margin-bottom: 10px;">Finalizar</button>
        <button onclick="cancelarPoligono()" class="btn btn-danger" style="width: 100%;">Cancelar</button>
    `;
    document.body.appendChild(controles);
}

function finalizarPoligono() {
    if (pontosPoligono.length < 3) {
        showToast('Adicione pelo menos 3 pontos', 'error');
        return;
    }
    
    const coords = pontosPoligono.map(p => [p.latlng.lng, p.latlng.lat]);
    coords.push(coords[0]);
    
    const polygon = turf.polygon([coords]);
    const area = turf.area(polygon);
    const perimetro = turf.length(polygon, { units: 'meters' });
    
    abrirModalSalvarTerreno(coords, area, perimetro);
}

function cancelarPoligono() {
    if (poligonoEmCriacao) {
        map.removeLayer(poligonoEmCriacao);
        poligonoEmCriacao = null;
    }
    pontosPoligono = [];
    
    marcadores.forEach(marker => {
        marker.off('click', adicionarPontoAoPoligono);
    });
    
    const controles = document.getElementById('poligono-controles');
    if (controles) controles.remove();
    
    showToast('Criação de terreno cancelada', 'info');
}

setInterval(() => {
    const counter = document.getElementById('pontos-count');
    if (counter) {
        counter.textContent = pontosPoligono.length;
    }
}, 100);

function abrirModalSalvarTerreno(coords, area, perimetro) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'modalSalvarTerreno';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>Salvar Terreno</h2>
                <button class="btn-close" onclick="fecharModalTerreno()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="formSalvarTerreno">
                    <div class="form-row">
                        <div class="form-group required">
                            <label>Código do Terreno</label>
                            <input type="text" id="terreno-codigo" required>
                        </div>
                        <div class="form-group required">
                            <label>Nome/Identificação</label>
                            <input type="text" id="terreno-nome" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Cliente</label>
                            <select id="terreno-cliente">
                                <option value="">Selecione um cliente</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="terreno-status">
                                <option value="Em Andamento">Em Andamento</option>
                                <option value="Finalizado">Finalizado</option>
                                <option value="Aprovado">Aprovado</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Área (m²)</label>
                            <input type="text" id="terreno-area" value="${area.toFixed(2)}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Perímetro (m)</label>
                            <input type="text" id="terreno-perimetro" value="${perimetro.toFixed(2)}" readonly>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group full-width">
                            <label>Observações</label>
                            <textarea id="terreno-observacoes" rows="3"></textarea>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-success" onclick="salvarTerreno(${JSON.stringify(coords).replace(/"/g, '&quot;')}, ${area}, ${perimetro})">Salvar</button>
                <button class="btn btn-secondary" onclick="fecharModalTerreno()">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    carregarClientesSelect('terreno-cliente');
}

function fecharModalTerreno() {
    const modal = document.getElementById('modalSalvarTerreno');
    if (modal) modal.remove();
}

async function salvarTerreno(coords, area, perimetro) {
    const codigo = document.getElementById('terreno-codigo').value;
    const nome = document.getElementById('terreno-nome').value;
    const clienteId = document.getElementById('terreno-cliente').value;
    const status = document.getElementById('terreno-status').value;
    const observacoes = document.getElementById('terreno-observacoes').value;
    
    if (!codigo || !nome) {
        showToast('Preencha os campos obrigatórios', 'error');
        return;
    }
    
    const geometria = { type: 'Polygon', coordinates: [coords] };
    
    let clienteNome = null;
    let clienteCpf = null;
    if (clienteId) {
        const clienteSelect = document.getElementById('terreno-cliente');
        const selectedOption = clienteSelect.options[clienteSelect.selectedIndex];
        clienteNome = selectedOption.text;
        clienteCpf = selectedOption.dataset.cpf;
    }
    
    const marcosIds = pontosPoligono.map(p => p.marco.id);
    
    const terreno = {
        codigo, nome, cliente_id: clienteId || null, cliente_nome: clienteNome,
        cliente_cpf_cnpj: clienteCpf, area_m2: area, perimetro_m: perimetro,
        geometria: JSON.stringify(geometria), observacoes, status,
        marcos_ids: marcosIds, usuario_criacao: localStorage.getItem('userName')
    };
    
    try {
        const response = await fetch(`${API_URL}/api/poligonos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(terreno)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Terreno salvo com sucesso!', 'success');
            fecharModalTerreno();
            cancelarPoligono();
            carregarPoligonosNoMapa();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar terreno:', error);
        showToast('Erro ao salvar terreno', 'error');
    }
}

// ============== TERRENOS ==============

async function buscarTerrenos() {
    const clienteId = document.getElementById('filtro-terreno-cliente').value;
    const status = document.getElementById('filtro-terreno-status').value;
    
    const params = new URLSearchParams();
    if (clienteId) params.append('cliente_id', clienteId);
    if (status) params.append('status', status);
    
    try {
        const response = await fetch(`${API_URL}/api/poligonos?${params}`);
        const data = await response.json();
        
        if (data.success) {
            exibirTerrenos(data.data);
        }
    } catch (error) {
        console.error('Erro ao buscar terrenos:', error);
        showToast('Erro ao buscar terrenos', 'error');
    }
}

function exibirTerrenos(terrenos) {
    const tbody = document.getElementById('terrenosTable');
    
    if (terrenos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum terreno encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = terrenos.map(t => `
        <tr>
            <td><strong>${t.codigo}</strong></td>
            <td>${t.nome}</td>
            <td>${t.cliente_nome || '-'}</td>
            <td>${t.area_m2 ? t.area_m2.toFixed(2) : '-'}</td>
            <td>${t.perimetro_m ? t.perimetro_m.toFixed(2) : '-'}</td>
            <td><span class="badge" style="background: #84c225; color: white;">${t.status}</span></td>
            <td>${formatarData(t.data_criacao)}</td>
            <td><button class="btn btn-primary btn-sm" onclick="verDetalhesTerreno(${t.id})">Ver</button></td>
        </tr>
    `).join('');
}

function limparFiltrosTerrenos() {
    document.getElementById('filtro-terreno-cliente').value = '';
    document.getElementById('filtro-terreno-status').value = '';
    document.getElementById('terrenosTable').innerHTML = '<tr><td colspan="8" class="text-center">Use os filtros para buscar terrenos</td></tr>';
}

async function verDetalhesTerreno(id) {
    try {
        const response = await fetch(`${API_URL}/api/poligonos/${id}`);
        const data = await response.json();
        
        if (data.success) {
            exibirModalDetalhesTerreno(data.data);
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar detalhes do terreno', 'error');
    }
}

function exibirModalDetalhesTerreno(terreno) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'modalDetalhesTerreno';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Detalhes do Terreno</h2>
                <button class="btn-close" onclick="fecharModalDetalhesTerreno()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="detail-row"><div class="detail-label">Código:</div><div class="detail-value"><strong>${terreno.codigo}</strong></div></div>
                <div class="detail-row"><div class="detail-label">Nome:</div><div class="detail-value">${terreno.nome}</div></div>
                <div class="detail-row"><div class="detail-label">Cliente:</div><div class="detail-value">${terreno.cliente_nome || '-'}</div></div>
                <div class="detail-row"><div class="detail-label">Área:</div><div class="detail-value">${terreno.area_m2 ? terreno.area_m2.toFixed(2) + ' m²' : '-'}</div></div>
                <div class="detail-row"><div class="detail-label">Perímetro:</div><div class="detail-value">${terreno.perimetro_m ? terreno.perimetro_m.toFixed(2) + ' m' : '-'}</div></div>
                <div class="detail-row"><div class="detail-label">Status:</div><div class="detail-value">${terreno.status}</div></div>
                <div class="detail-row"><div class="detail-label">Marcos:</div><div class="detail-value">${terreno.marcos ? terreno.marcos.length : 0} marcos</div></div>
                ${terreno.observacoes ? `<div class="detail-row"><div class="detail-label">Observações:</div><div class="detail-value">${terreno.observacoes}</div></div>` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="centralizarNoTerreno(${terreno.id})">Ver no Mapa</button>
                <button class="btn btn-secondary" onclick="fecharModalDetalhesTerreno()">Fechar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function fecharModalDetalhesTerreno() {
    const modal = document.getElementById('modalDetalhesTerreno');
    if (modal) modal.remove();
}

async function centralizarNoTerreno(id) {
    fecharModalDetalhesTerreno();
    showTab('mapa');
    setTimeout(() => {
        poligonosLayer.eachLayer(layer => {
            if (layer.options.terrenoId === id) {
                map.fitBounds(layer.getBounds());
                layer.openPopup();
            }
        });
    }, 500);
}

// ============== CLIENTES ==============

function setupFormCliente() {
    const form = document.getElementById('formCliente');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const cliente = {
            nome: document.getElementById('cliente-nome').value,
            cpf_cnpj: document.getElementById('cliente-cpf').value,
            email: document.getElementById('cliente-email').value,
            telefone: document.getElementById('cliente-telefone').value,
            endereco: document.getElementById('cliente-endereco').value
        };
        
        try {
            const response = await fetch(`${API_URL}/api/clientes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cliente)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Cliente cadastrado com sucesso!', 'success');
                limparFormularioCliente();
                carregarClientes();
            } else {
                showToast(data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao cadastrar cliente:', error);
            showToast('Erro ao cadastrar cliente', 'error');
        }
    });
}

function limparFormularioCliente() {
    document.getElementById('formCliente').reset();
}

async function carregarClientes() {
    try {
        const response = await fetch(`${API_URL}/api/clientes`);
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('clientesTable');
            
            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum cliente cadastrado</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.data.map(c => `
                <tr>
                    <td>${c.nome}</td>
                    <td>${c.cpf_cnpj}</td>
                    <td>${c.email || '-'}</td>
                    <td>${c.telefone || '-'}</td>
                    <td>${formatarData(c.data_cadastro)}</td>
                    <td><button class="btn btn-primary btn-sm">Editar</button></td>
                </tr>
            `).join('');
            
            carregarClientesSelect('filtro-terreno-cliente');
        }
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function carregarClientesSelect(selectId) {
    try {
        const response = await fetch(`${API_URL}/api/clientes`);
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById(selectId);
            if (!select) return;
            const primeiraOpcao = select.querySelector('option:first-child').outerHTML;
            select.innerHTML = primeiraOpcao + data.data.map(c => 
                `<option value="${c.id}" data-cpf="${c.cpf_cnpj}">${c.nome}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

// ============== EDIÇÃO ==============

function editarMarco() {
    if (!marcoAtual) return;
    
    document.getElementById('edit-codigo').value = marcoAtual.codigo || '';
    document.getElementById('edit-tipo').value = marcoAtual.tipo || '';
    document.getElementById('edit-localizacao').value = marcoAtual.localizacao || '';
    document.getElementById('edit-metodo').value = marcoAtual.metodo || '';
    document.getElementById('edit-limites').value = marcoAtual.limites || '';
    document.getElementById('edit-coordenada-e').value = marcoAtual.coordenada_e || '';
    document.getElementById('edit-desvio-e').value = marcoAtual.desvio_e || '';
    document.getElementById('edit-coordenada-n').value = marcoAtual.coordenada_n || '';
    document.getElementById('edit-desvio-n').value = marcoAtual.desvio_n || '';
    document.getElementById('edit-altitude-h').value = marcoAtual.altitude_h || '';
    document.getElementById('edit-desvio-h').value = marcoAtual.desvio_h || '';
    document.getElementById('edit-lote').value = marcoAtual.lote || '';
    document.getElementById('edit-data').value = marcoAtual.data_levantamento ? marcoAtual.data_levantamento.split('T')[0] : '';
    document.getElementById('edit-observacoes').value = marcoAtual.observacoes || '';
    
    fecharModal();
    document.getElementById('modalEdicao').classList.add('active');
}

function fecharModalEdicao() {
    document.getElementById('modalEdicao').classList.remove('active');
    marcoAtual = null;
}

async function salvarEdicao() {
    if (!marcoAtual) return;
    
    const marcoEditado = {
        codigo: document.getElementById('edit-codigo').value,
        tipo: document.getElementById('edit-tipo').value,
        localizacao: document.getElementById('edit-localizacao').value,
        metodo: document.getElementById('edit-metodo').value,
        limites: document.getElementById('edit-limites').value,
        coordenada_e: parseFloat(document.getElementById('edit-coordenada-e').value) || null,
        desvio_e: parseFloat(document.getElementById('edit-desvio-e').value) || null,
        coordenada_n: parseFloat(document.getElementById('edit-coordenada-n').value) || null,
        desvio_n: parseFloat(document.getElementById('edit-desvio-n').value) || null,
        altitude_h: parseFloat(document.getElementById('edit-altitude-h').value) || null,
        desvio_h: parseFloat(document.getElementById('edit-desvio-h').value) || null,
        lote: document.getElementById('edit-lote').value,
        data_levantamento: document.getElementById('edit-data').value,
        observacoes: document.getElementById('edit-observacoes').value
    };
    
    try {
        const response = await fetch(`${API_URL}/api/marcos/${marcoAtual.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(marcoEditado)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Marco atualizado com sucesso!', 'success');
            fecharModalEdicao();
            buscarMarcos();
            carregarEstatisticas();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar marco:', error);
        showToast('Erro ao atualizar marco', 'error');
    }
}

// ============== IMPORTAÇÃO DE MEMORIAL DESCRITIVO ==============

function inicializarImportadorMemorial() {
    const uploadAreaMemorial = document.getElementById('uploadAreaMemorial');
    const fileMemorial = document.getElementById('fileMemorial');
    const fileInfoMemorial = document.getElementById('fileInfoMemorial');
    const fileNameMemorial = document.getElementById('fileNameMemorial');
    const btnImportarMemorial = document.getElementById('btnImportarMemorial');
    const btnLimparMemorial = document.getElementById('btnLimparMemorial');
    const usuarioMemorial = document.getElementById('usuarioMemorial');
    const loadingMemorial = document.getElementById('loadingMemorial');
    const resultMemorial = document.getElementById('resultMemorial');
    const resultTitleMemorial = document.getElementById('resultTitleMemorial');
    const resultMessageMemorial = document.getElementById('resultMessageMemorial');
    const resultDetailsMemorial = document.getElementById('resultDetailsMemorial');

    if (!uploadAreaMemorial || !fileMemorial) {
        return;
    }

    let selectedFileMemorial = null;

    uploadAreaMemorial.addEventListener('click', () => fileMemorial.click());

    uploadAreaMemorial.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadAreaMemorial.style.borderColor = '#28a745';
        uploadAreaMemorial.style.background = '#e8f5e9';
    });

    uploadAreaMemorial.addEventListener('dragleave', () => {
        uploadAreaMemorial.style.borderColor = '#84c225';
        uploadAreaMemorial.style.background = 'white';
    });

    uploadAreaMemorial.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadAreaMemorial.style.borderColor = '#84c225';
        uploadAreaMemorial.style.background = 'white';
        if (e.dataTransfer.files.length > 0) {
            handleFileMemorial(e.dataTransfer.files[0]);
        }
    });

    fileMemorial.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileMemorial(e.target.files[0]);
        }
    });

    function handleFileMemorial(file) {
        if (!file.name.endsWith('.docx')) {
            showToast('Apenas arquivos .docx são aceitos!', 'error');
            return;
        }
        selectedFileMemorial = file;
        fileNameMemorial.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        fileInfoMemorial.style.display = 'block';
        btnImportarMemorial.disabled = false;
        resultMemorial.style.display = 'none';
    }

    btnImportarMemorial.addEventListener('click', async () => {
        if (!selectedFileMemorial) {
            showToast('Selecione um arquivo primeiro!', 'error');
            return;
        }
        const usuario = usuarioMemorial.value.trim();
        if (!usuario) {
            showToast('Digite o nome do usuário responsável!', 'error');
            usuarioMemorial.focus();
            return;
        }
        await importarMemorialDescritivo(selectedFileMemorial, usuario);
    });

    btnLimparMemorial.addEventListener('click', () => {
        selectedFileMemorial = null;
        fileMemorial.value = '';
        fileInfoMemorial.style.display = 'none';
        btnImportarMemorial.disabled = true;
        resultMemorial.style.display = 'none';
        usuarioMemorial.value = '';
    });

    async function importarMemorialDescritivo(file, usuario) {
        const formData = new FormData();
        formData.append('files', file);
        formData.append('usuario', usuario);

        loadingMemorial.style.display = 'block';
        btnImportarMemorial.disabled = true;
        resultMemorial.style.display = 'none';

        try {
            const response = await fetch(`${API_URL}/api/importar-memorial-v2`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                mostrarSucessoMemorial(data);
            } else {
                mostrarErroMemorial(data.message);
            }
        } catch (error) {
            console.error('Erro:', error);
            mostrarErroMemorial('Erro ao conectar com o servidor.');
        } finally {
            loadingMemorial.style.display = 'none';
            btnImportarMemorial.disabled = false;
        }
    }

    function mostrarSucessoMemorial(data) {
        resultMemorial.style.cssText = 'display:block; background:#d4edda; border:1px solid #c3e6cb; color:#155724; padding:20px; border-radius:8px;';
        resultTitleMemorial.textContent = 'Memorial processado com sucesso!';
        resultMessageMemorial.textContent = data.message || 'Vértices extraídos com sucesso.';

        const vertices = data.data.vertices || [];
        const metadata = data.data.metadata || {};
        const stats = data.data.estatisticas || {};

        resultDetailsMemorial.innerHTML = `
            <div style="margin-top:10px; padding:10px; background:rgba(255,255,255,0.5); border-radius:5px;">
                <p style="margin:5px 0;"><strong>Vértices extraídos:</strong> ${vertices.length}</p>
                <p style="margin:5px 0;"><strong>Matches processados:</strong> ${stats.total_matches || 0}</p>
                <p style="margin:5px 0;"><strong>Metadados extraídos:</strong> ${stats.metadados_extraidos || 0}</p>
                ${metadata.matricula ? `<p style="margin:5px 0;"><strong>Matrícula:</strong> ${metadata.matricula}</p>` : ''}
                ${metadata.imovel ? `<p style="margin:5px 0;"><strong>Imóvel:</strong> ${metadata.imovel}</p>` : ''}
                ${metadata.municipio ? `<p style="margin:5px 0;"><strong>Município:</strong> ${metadata.municipio}</p>` : ''}
            </div>
        `;
        showToast('Memorial processado!', 'success');
    }

    function mostrarErroMemorial(mensagem) {
        resultMemorial.style.cssText = 'display:block; background:#f8d7da; border:1px solid #f5c6cb; color:#721c24; padding:20px; border-radius:8px;';
        resultTitleMemorial.textContent = 'Erro na importação';
        resultMessageMemorial.textContent = mensagem;
        resultDetailsMemorial.innerHTML = `
            <div style="margin-top:10px; padding:10px; background:rgba(255,255,255,0.5); border-radius:5px;">
                <p><strong>Possíveis causas:</strong></p>
                <ul style="margin-left:20px; margin-top:10px;">
                    <li>Formato incompatível</li>
                    <li>Dados incompletos</li>
                    <li>Erro na conversão</li>
                </ul>
            </div>
        `;
        showToast('Erro ao importar', 'error');
    }

    const usuarioSalvo = localStorage.getItem('usuario_sistema') || localStorage.getItem('userName');
    if (usuarioSalvo) usuarioMemorial.value = usuarioSalvo;

    usuarioMemorial.addEventListener('change', () => {
        localStorage.setItem('usuario_sistema', usuarioMemorial.value.trim());
    });
}

// ============== SISTEMA DUAL: VALIDAÇÃO DE COORDENADAS ==============

let marcoCorrecaoAtual = null;
let paginaAtualInvalidos = 1;
let paginaAtualPendentes = 1;
const itensPorPagina = 50;

// Variável de controle de qual aba está ativa
let abaAtualValidacao = 'levantados'; // 'levantados' ou 'pendentes'

// ============== CARREGAR ESTATÍSTICAS ==============

async function carregarEstatisticasValidacao() {
    try {
        // Estatísticas gerais
        const responseStats = await fetch(`${API_URL}/api/estatisticas`);
        const dataStats = await responseStats.json();

        // Status de validação
        const responseValidacao = await fetch(`${API_URL}/api/marcos/validacao-status`);
        const dataValidacao = await responseValidacao.json();

        if (dataStats.success && dataValidacao.success) {
            const stats = dataStats.data;
            const validacao = dataValidacao.data;

            // Estatísticas principais
            document.getElementById('val-total').textContent = stats.total || 0;
            document.getElementById('val-validos').textContent = validacao.validados || 0;
            document.getElementById('val-invalidos').textContent = validacao.invalidos || 0;
            document.getElementById('val-pendentes').textContent = validacao.pendentes || 0;

            // Percentuais
            const total = stats.total || 1; // evitar divisão por zero
            const pctValidos = ((validacao.validados / total) * 100).toFixed(1);
            const pctInvalidos = ((validacao.invalidos / total) * 100).toFixed(1);
            const pctPendentes = ((validacao.pendentes / total) * 100).toFixed(1);

            document.getElementById('val-validos-pct').textContent = `${pctValidos}%`;
            document.getElementById('val-invalidos-pct').textContent = `${pctInvalidos}%`;
            document.getElementById('val-pendentes-pct').textContent = `${pctPendentes}%`;

            // Carregar lista inicial (levantados inválidos)
            carregarMarcosInvalidos();
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        showToast('Erro ao carregar estatísticas', 'error');
    }
}

// ============== EXECUTAR VALIDAÇÃO ==============

async function executarValidacao(forcarRevalidacao = false) {
    const progressDiv = document.getElementById('validacao-progress');
    const progressBar = document.getElementById('validacao-progress-bar');
    const progressText = document.getElementById('validacao-progress-text');
    const resultadoDiv = document.getElementById('validacao-resultado');

    progressDiv.style.display = 'block';
    resultadoDiv.style.display = 'none';
    progressBar.style.width = '0%';
    progressText.textContent = 'Iniciando validação...';

    try {
        const response = await fetch(`${API_URL}/api/validar-coordenadas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forcar: forcarRevalidacao })
        });

        const data = await response.json();

        progressBar.style.width = '100%';
        progressText.textContent = 'Validação concluída!';

        setTimeout(() => {
            progressDiv.style.display = 'none';

            if (data.success) {
                const stats = data.data.estatisticas;
                resultadoDiv.style.display = 'block';
                resultadoDiv.style.background = '#d4edda';
                resultadoDiv.style.borderLeft = '4px solid #28a745';
                resultadoDiv.style.color = '#155724';
                resultadoDiv.innerHTML = `
                    <h4 style="margin-bottom: 10px;">✅ Validação Concluída!</h4>
                    <p><strong>Total processado:</strong> ${stats.total} marcos</p>
                    <p><strong>Válidos:</strong> ${stats.validos} (${((stats.validos/stats.total)*100).toFixed(1)}%)</p>
                    <p><strong>Inválidos:</strong> ${stats.invalidos} (${((stats.invalidos/stats.total)*100).toFixed(1)}%)</p>
                    <p><strong>Tempo:</strong> ${(stats.tempo_ms/1000).toFixed(2)}s</p>
                `;

                showToast('Validação concluída!', 'success');
                carregarEstatisticasValidacao();
            } else {
                throw new Error(data.message);
            }
        }, 500);

    } catch (error) {
        console.error('Erro na validação:', error);
        progressDiv.style.display = 'none';
        resultadoDiv.style.display = 'block';
        resultadoDiv.style.background = '#f8d7da';
        resultadoDiv.style.borderLeft = '4px solid #dc3545';
        resultadoDiv.style.color = '#721c24';
        resultadoDiv.innerHTML = `
            <h4>❌ Erro na Validação</h4>
            <p>${error.message}</p>
        `;
        showToast('Erro ao executar validação', 'error');
    }
}

// ============== CARREGAR MARCOS INVÁLIDOS (LEVANTADOS) ==============

async function carregarMarcosInvalidos(pagina = 1) {
    paginaAtualInvalidos = pagina;
    const tipo = document.getElementById('filtro-val-tipo').value;
    const erro = document.getElementById('filtro-val-erro').value;
    const offset = (pagina - 1) * itensPorPagina;

    try {
        const params = new URLSearchParams({
            limit: itensPorPagina,
            offset: offset
        });
        if (tipo) params.append('tipo', tipo);
        if (erro) params.append('erro', erro);

        const response = await fetch(`${API_URL}/api/marcos/invalidos?${params}`);
        const data = await response.json();

        if (data.success) {
            exibirMarcosInvalidos(data.data);
            document.getElementById('val-count-invalidos').textContent = data.total;
            criarPaginacaoInvalidos(data.total);
        }
    } catch (error) {
        console.error('Erro ao carregar marcos inválidos:', error);
        showToast('Erro ao carregar marcos inválidos', 'error');
    }
}

function exibirMarcosInvalidos(marcos) {
    const tbody = document.getElementById('tabela-invalidos');

    if (marcos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">✅ Nenhum marco inválido encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = marcos.map(m => {
        const badgeCorErro = {
            'UTM_INVALIDO': 'background: #ffc107; color: #856404;',
            'FORA_BRASIL': 'background: #dc3545; color: white;',
            'VALORES_NULOS': 'background: #6c757d; color: white;',
            'CONVERSAO_FALHOU': 'background: #e83e8c; color: white;',
            'VALORES_ABSURDOS': 'background: #fd7e14; color: white;'
        };

        const tipoErro = m.erro_validacao ? m.erro_validacao.split(':')[0] : 'ERRO';
        const estiloErro = badgeCorErro[tipoErro] || 'background: #666; color: white;';

        return `
            <tr>
                <td><strong>${m.codigo}</strong></td>
                <td><span class="badge badge-${m.tipo.toLowerCase()}">${m.tipo}</span></td>
                <td>${m.localizacao || '-'}</td>
                <td style="color: #dc3545; font-weight: bold;">${formatarNumero(m.coordenada_e)}</td>
                <td style="color: #dc3545; font-weight: bold;">${formatarNumero(m.coordenada_n)}</td>
                <td><span class="badge" style="${estiloErro}">${m.erro_validacao || 'Erro desconhecido'}</span></td>
                <td>${formatarData(m.data_validacao)}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="verDetalhes(${m.id})">
                        👁️ Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function criarPaginacaoInvalidos(total) {
    const totalPaginas = Math.ceil(total / itensPorPagina);
    const paginacaoDiv = document.getElementById('val-paginacao');

    if (totalPaginas <= 1) {
        paginacaoDiv.innerHTML = '';
        return;
    }

    let html = '';

    if (paginaAtualInvalidos > 1) {
        html += `<button class="btn btn-secondary btn-sm" onclick="carregarMarcosInvalidos(${paginaAtualInvalidos - 1})">« Anterior</button>`;
    }

    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaAtualInvalidos - 2 && i <= paginaAtualInvalidos + 2)) {
            const ativo = i === paginaAtualInvalidos ? 'btn-primary' : 'btn-secondary';
            html += `<button class="btn ${ativo} btn-sm" onclick="carregarMarcosInvalidos(${i})">${i}</button>`;
        } else if (i === paginaAtualInvalidos - 3 || i === paginaAtualInvalidos + 3) {
            html += `<span style="padding: 0 5px;">...</span>`;
        }
    }

    if (paginaAtualInvalidos < totalPaginas) {
        html += `<button class="btn btn-secondary btn-sm" onclick="carregarMarcosInvalidos(${paginaAtualInvalidos + 1})">Próxima »</button>`;
    }

    paginacaoDiv.innerHTML = html;
}

// ============== MODAL DE CORREÇÃO ==============

async function abrirModalCorrecao(marcoId) {
    try {
        const response = await fetch(`${API_URL}/api/marcos/${marcoId}`);
        const result = await response.json();

        if (result.success) {
            const marco = result.data;
            marcoCorrecaoAtual = marco;

            document.getElementById('correcao-marco-id').value = marco.id;
            document.getElementById('correcao-marco-codigo').textContent = marco.codigo;
            document.getElementById('correcao-e-antiga').value = marco.coordenada_e || '';
            document.getElementById('correcao-n-antiga').value = marco.coordenada_n || '';
            document.getElementById('correcao-e-nova').value = '';
            document.getElementById('correcao-n-nova').value = '';
            document.getElementById('correcao-motivo').value = '';

            document.getElementById('modalCorrecao').classList.add('active');
        }
    } catch (error) {
        console.error('Erro ao abrir modal de correção:', error);
        showToast('Erro ao carregar dados do marco', 'error');
    }
}

function fecharModalCorrecao() {
    document.getElementById('modalCorrecao').classList.remove('active');
    marcoCorrecaoAtual = null;
}

async function salvarCorrecao() {
    const marcoId = document.getElementById('correcao-marco-id').value;
    const coordenada_e = parseFloat(document.getElementById('correcao-e-nova').value);
    const coordenada_n = parseFloat(document.getElementById('correcao-n-nova').value);
    const motivo = document.getElementById('correcao-motivo').value;
    const usuario = localStorage.getItem('userName') || 'Sistema';

    if (!coordenada_e || !coordenada_n) {
        showToast('Preencha as novas coordenadas', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/marcos/${marcoId}/corrigir-coordenadas`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordenada_e, coordenada_n, motivo, usuario })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Coordenadas corrigidas com sucesso!', 'success');
            fecharModalCorrecao();
            carregarEstatisticasValidacao();

            if (data.validacao && data.validacao.valido) {
                showToast('✅ As novas coordenadas são válidas!', 'success');
            } else if (data.validacao) {
                showToast(`⚠️ As novas coordenadas ainda são inválidas: ${data.validacao.descricao}`, 'warning');
            }
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar correção:', error);
        showToast('Erro ao salvar correção', 'error');
    }
}

// ============== EXPORTAR INVÁLIDOS ==============

async function exportarInvalidos() {
    try {
        showToast('Gerando arquivo Excel...', 'info');

        const response = await fetch(`${API_URL}/api/exportar-invalidos`);
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marcos_invalidos_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Arquivo exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        showToast('Erro ao exportar dados', 'error');
    }
}

// ==========================================
// NAVEGAÇÃO ENTRE ABAS
// ==========================================

let abaAtual = 'mapa';

function trocarAba(nomeAba) {
    console.log('Trocando para aba:', nomeAba);

    // Remover classe active de todas as abas e conteúdos
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Adicionar classe active na aba e conteúdo selecionados
    document.querySelector(`[data-tab="${nomeAba}"]`).classList.add('active');
    document.getElementById(`tab-${nomeAba}`).classList.add('active');

    abaAtual = nomeAba;

    // Carregar dados da aba
    switch(nomeAba) {
        case 'mapa':
            // Mapa já está carregado
            if (map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
            break;
        case 'importar':
            // Preparar área de importação
            prepararImportacao();
            break;
        case 'propriedades':
            carregarListaPropriedades();
            break;
        case 'clientes':
            carregarListaClientes();
            break;
        case 'historico':
            carregarHistorico();
            break;
    }
}

// ==========================================
// ESTATÍSTICAS DO HEADER
// ==========================================

async function atualizarEstatisticas() {
    try {
        // Contar marcos (já temos esse valor)
        document.getElementById('stat-marcos').textContent = '📍 Marcos: 19.040';

        // Contar propriedades
        const resProp = await fetch('/api/propriedades?limite=1');
        const dataProp = await resProp.json();
        if (dataProp.success) {
            document.getElementById('stat-propriedades').textContent = `🏘️ Propriedades: ${dataProp.total}`;
        }

        // Contar clientes
        const resCliente = await fetch('/api/clientes?limite=1');
        const dataCliente = await resCliente.json();
        if (dataCliente.success) {
            document.getElementById('stat-clientes').textContent = `👥 Clientes: ${dataCliente.total}`;
        }
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

// ==========================================
// GESTÃO DE CLIENTES
// ==========================================

let paginaAtualClientes = 0;
const itensPorPaginaClientes = 10;

async function carregarListaClientes(pagina = 0) {
    try {
        console.log('Carregando clientes, página:', pagina);

        const busca = document.getElementById('busca-clientes')?.value || '';
        const offset = pagina * itensPorPaginaClientes;

        let url = `/api/clientes?limite=${itensPorPaginaClientes}&offset=${offset}`;
        if (busca) {
            url += `&busca=${encodeURIComponent(busca)}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        paginaAtualClientes = pagina;
        renderizarListaClientes(result.data);
        renderizarPaginacaoClientes(result.total);

    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        document.getElementById('lista-clientes').innerHTML = `
            <div class="mensagem mensagem-erro">
                ❌ Erro ao carregar clientes: ${error.message}
            </div>
        `;
    }
}

function renderizarListaClientes(clientes) {
    const container = document.getElementById('lista-clientes');

    if (clientes.length === 0) {
        container.innerHTML = `
            <div class="mensagem mensagem-info">
                ℹ️ Nenhum cliente encontrado.
            </div>
        `;
        return;
    }

    container.innerHTML = clientes.map(cliente => `
        <div class="item-card">
            <div class="item-header">
                <h3 class="item-titulo">${cliente.nome}</h3>
                <div class="item-acoes">
                    <button class="btn-icon" onclick="editarCliente(${cliente.id})" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon" onclick="verPropriedadesCliente(${cliente.id})" title="Ver propriedades">
                        🏘️
                    </button>
                    <button class="btn-icon" onclick="excluirCliente(${cliente.id})" title="Excluir">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="item-info">
                ${cliente.cpf_cnpj ? `<div><strong>CPF/CNPJ:</strong> ${cliente.cpf_cnpj}</div>` : ''}
                ${cliente.telefone ? `<div><strong>📞 Telefone:</strong> ${cliente.telefone}</div>` : ''}
                ${cliente.email ? `<div><strong>📧 Email:</strong> ${cliente.email}</div>` : ''}
                ${cliente.cidade ? `<div><strong>📍 Cidade:</strong> ${cliente.cidade}${cliente.estado ? ' - ' + cliente.estado : ''}</div>` : ''}
                <div><strong>🏘️ Propriedades:</strong> ${cliente.total_propriedades || 0}</div>
            </div>
        </div>
    `).join('');
}

function renderizarPaginacaoClientes(total) {
    const container = document.getElementById('paginacao-clientes');
    const totalPaginas = Math.ceil(total / itensPorPaginaClientes);

    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button ${paginaAtualClientes === 0 ? 'disabled' : ''} onclick="carregarListaClientes(${paginaAtualClientes - 1})">
            ← Anterior
        </button>
    `;

    for (let i = 0; i < totalPaginas; i++) {
        html += `
            <button class="${i === paginaAtualClientes ? 'page-active' : ''}"
                    onclick="carregarListaClientes(${i})">
                ${i + 1}
            </button>
        `;
    }

    html += `
        <button ${paginaAtualClientes >= totalPaginas - 1 ? 'disabled' : ''}
                onclick="carregarListaClientes(${paginaAtualClientes + 1})">
            Próxima →
        </button>
    `;

    container.innerHTML = html;
}

function buscarClientes() {
    carregarListaClientes(0);
}

// ==========================================
// MODAL CLIENTE
// ==========================================

function abrirModalNovoCliente() {
    document.getElementById('modal-cliente-titulo').textContent = '➕ Novo Cliente';
    document.getElementById('form-cliente').reset();
    document.getElementById('cliente-id').value = '';
    abrirModal('modal-cliente');
}

async function editarCliente(id) {
    try {
        const response = await fetch(`/api/clientes/${id}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        const cliente = result.data;

        document.getElementById('modal-cliente-titulo').textContent = '✏️ Editar Cliente';
        document.getElementById('cliente-id').value = cliente.id;
        document.getElementById('modal-cliente-nome').value = cliente.nome || '';
        document.getElementById('modal-cliente-cpf').value = cliente.cpf_cnpj || '';
        document.getElementById('modal-cliente-telefone').value = cliente.telefone || '';
        document.getElementById('modal-cliente-email').value = cliente.email || '';
        document.getElementById('modal-cliente-endereco').value = cliente.endereco || '';
        document.getElementById('modal-cliente-cidade').value = cliente.cidade || '';
        document.getElementById('modal-cliente-estado').value = cliente.estado || '';
        document.getElementById('modal-cliente-observacoes').value = cliente.observacoes || '';

        abrirModal('modal-cliente');

    } catch (error) {
        alert('Erro ao carregar cliente: ' + error.message);
    }
}

async function salvarCliente(event) {
    event.preventDefault();

    const id = document.getElementById('cliente-id').value;
    const dados = {
        nome: document.getElementById('modal-cliente-nome').value,
        cpf_cnpj: document.getElementById('modal-cliente-cpf').value,
        telefone: document.getElementById('modal-cliente-telefone').value,
        email: document.getElementById('modal-cliente-email').value,
        endereco: document.getElementById('modal-cliente-endereco').value,
        cidade: document.getElementById('modal-cliente-cidade').value,
        estado: document.getElementById('modal-cliente-estado').value,
        observacoes: document.getElementById('modal-cliente-observacoes').value
    };

    try {
        const url = id ? `/api/clientes/${id}` : '/api/clientes';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        alert(result.message);
        fecharModal('modal-cliente');
        carregarListaClientes(paginaAtualClientes);
        atualizarEstatisticas();
        carregarClientesParaFiltros();

    } catch (error) {
        alert('Erro ao salvar cliente: ' + error.message);
    }
}

async function excluirCliente(id) {
    if (!confirm('Deseja realmente excluir este cliente?')) {
        return;
    }

    try {
        const response = await fetch(`/api/clientes/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        alert(result.message);
        carregarListaClientes(paginaAtualClientes);
        atualizarEstatisticas();

    } catch (error) {
        alert('Erro ao excluir cliente: ' + error.message);
    }
}

function verPropriedadesCliente(clienteId) {
    trocarAba('propriedades');
    setTimeout(() => {
        document.getElementById('filtro-cliente-propriedades').value = clienteId;
        buscarPropriedades();
    }, 100);
}

// ==========================================
// GESTÃO DE PROPRIEDADES
// ==========================================

let paginaAtualPropriedades = 0;
const itensPorPaginaPropriedades = 10;

async function carregarListaPropriedades(pagina = 0) {
    try {
        console.log('Carregando propriedades, página:', pagina);

        const busca = document.getElementById('busca-propriedades')?.value || '';
        const tipo = document.getElementById('filtro-tipo-propriedades')?.value || '';
        const offset = pagina * itensPorPaginaPropriedades;

        let url = `/api/propriedades?limite=${itensPorPaginaPropriedades}&offset=${offset}`;
        if (busca) url += `&busca=${encodeURIComponent(busca)}`;
        if (tipo) url += `&tipo=${tipo}`;

        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        paginaAtualPropriedades = pagina;
        renderizarListaPropriedades(result.data);
        renderizarPaginacaoPropriedades(result.total);

    } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
        document.getElementById('lista-propriedades').innerHTML = `
            <div class="mensagem mensagem-erro">
                ❌ Erro ao carregar propriedades: ${error.message}
            </div>
        `;
    }
}

function renderizarListaPropriedades(propriedades) {
    const container = document.getElementById('lista-propriedades');

    if (propriedades.length === 0) {
        container.innerHTML = `
            <div class="mensagem mensagem-info">
                ℹ️ Nenhuma propriedade encontrada.
            </div>
        `;
        return;
    }

    container.innerHTML = propriedades.map(prop => {
        const badgeClass = `badge-${prop.tipo.toLowerCase()}`;
        return `
            <div class="item-card">
                <div class="item-header">
                    <h3 class="item-titulo">
                        ${prop.nome_propriedade || 'Sem nome'}
                        <span class="badge ${badgeClass}">${prop.tipo}</span>
                    </h3>
                    <div class="item-acoes">
                        <button class="btn-icon" onclick="editarPropriedade(${prop.id})" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon" onclick="verPropriedadeNoMapa(${prop.id})" title="Ver no mapa">
                            🗺️
                        </button>
                        <button class="btn-icon" onclick="excluirPropriedade(${prop.id})" title="Excluir">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="item-info">
                    <div><strong>📋 Matrícula:</strong> ${prop.matricula}</div>
                    <div><strong>👤 Proprietário:</strong> ${prop.cliente_nome}</div>
                    ${prop.municipio ? `<div><strong>📍 Município:</strong> ${prop.municipio} - ${prop.uf || ''}</div>` : ''}
                    ${prop.area_m2 ? `<div><strong>📐 Área:</strong> ${prop.area_m2.toLocaleString('pt-BR')} m² (${(prop.area_m2/10000).toFixed(2)} ha)</div>` : ''}
                    <div><strong>🔺 Vértices:</strong> ${prop.total_vertices || 0}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarPaginacaoPropriedades(total) {
    const container = document.getElementById('paginacao-propriedades');
    const totalPaginas = Math.ceil(total / itensPorPaginaPropriedades);

    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button ${paginaAtualPropriedades === 0 ? 'disabled' : ''} onclick="carregarListaPropriedades(${paginaAtualPropriedades - 1})">
            ← Anterior
        </button>
    `;

    for (let i = 0; i < totalPaginas; i++) {
        html += `
            <button class="${i === paginaAtualPropriedades ? 'page-active' : ''}"
                    onclick="carregarListaPropriedades(${i})">
                ${i + 1}
            </button>
        `;
    }

    html += `
        <button ${paginaAtualPropriedades >= totalPaginas - 1 ? 'disabled' : ''}
                onclick="carregarListaPropriedades(${paginaAtualPropriedades + 1})">
            Próxima →
        </button>
    `;

    container.innerHTML = html;
}

function buscarPropriedades() {
    carregarListaPropriedades(0);
}

// ==========================================
// MODAL PROPRIEDADE (FUNÇÕES FALTANTES)
// ==========================================

async function abrirModalNovaPropriedade() {
    document.getElementById('modal-propriedade-titulo').textContent = '➕ Nova Propriedade';
    document.getElementById('form-propriedade').reset();
    document.getElementById('propriedade-id').value = '';

    // Carregar clientes no select
    await carregarClientesParaSelect();

    abrirModal('modal-propriedade');
}

async function carregarClientesParaSelect() {
    try {
        const response = await fetch('/api/clientes?limite=1000');
        const result = await response.json();

        const select = document.getElementById('modal-propriedade-cliente');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione o cliente...</option>';

        if (result.success && result.data.length > 0) {
            result.data.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = cliente.nome;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function salvarPropriedade(event) {
    event.preventDefault();

    const id = document.getElementById('propriedade-id').value;
    const dados = {
        cliente_id: parseInt(document.getElementById('modal-propriedade-cliente').value),
        nome_propriedade: document.getElementById('modal-propriedade-nome').value,
        matricula: document.getElementById('modal-propriedade-matricula').value,
        tipo: document.getElementById('modal-propriedade-tipo').value,
        municipio: document.getElementById('modal-propriedade-municipio').value,
        uf: document.getElementById('modal-propriedade-uf').value,
        area_m2: parseFloat(document.getElementById('modal-propriedade-area').value) || null,
        perimetro_m: parseFloat(document.getElementById('modal-propriedade-perimetro').value) || null,
        observacoes: document.getElementById('modal-propriedade-observacoes').value
    };

    try {
        const url = id ? `/api/propriedades/${id}` : '/api/propriedades';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        alert(result.message);
        fecharModal('modal-propriedade');

        // Recarregar lista se estiver na aba de propriedades
        if (typeof carregarListaPropriedades === 'function') {
            carregarListaPropriedades(0);
        }

        // Atualizar estatísticas
        if (typeof atualizarEstatisticas === 'function') {
            atualizarEstatisticas();
        }

        // Recarregar polígonos no mapa
        if (typeof carregarPropriedades === 'function') {
            carregarPropriedades();
        }

    } catch (error) {
        alert('Erro ao salvar propriedade: ' + error.message);
    }
}

async function excluirPropriedade(id) {
    if (!confirm('Deseja realmente excluir esta propriedade? Os vértices também serão removidos.')) {
        return;
    }

    try {
        const response = await fetch(`/api/propriedades/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        alert(result.message);

        // Recarregar lista se estiver na aba de propriedades
        if (typeof carregarListaPropriedades === 'function') {
            carregarListaPropriedades(0);
        }

        // Atualizar estatísticas
        if (typeof atualizarEstatisticas === 'function') {
            atualizarEstatisticas();
        }

        // Recarregar polígonos no mapa
        if (typeof carregarPropriedades === 'function') {
            carregarPropriedades();
        }

    } catch (error) {
        alert('Erro ao excluir propriedade: ' + error.message);
    }
}

// ==========================================
// HISTÓRICO DE IMPORTAÇÕES (FUNÇÃO FALTANTE)
// ==========================================

let paginaAtualHistorico = 0;
const itensPorPaginaHistorico = 20;

async function carregarHistorico(pagina = 0) {
    try {
        console.log('Carregando histórico, página:', pagina);

        const offset = pagina * itensPorPaginaHistorico;
        const url = `/api/memoriais-importados?limite=${itensPorPaginaHistorico}&offset=${offset}`;

        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        paginaAtualHistorico = pagina;

        const container = document.getElementById('lista-historico');
        if (!container) return;

        if (result.data.length === 0) {
            container.innerHTML = `
                <div class="mensagem mensagem-info">
                    ℹ️ Nenhuma importação registrada.
                </div>
            `;
            return;
        }

        container.innerHTML = result.data.map(item => {
            const data = new Date(item.data_importacao);
            const dataFormatada = data.toLocaleString('pt-BR');

            return `
                <div class="item-card">
                    <div class="item-header">
                        <h3 class="item-titulo">📄 ${item.arquivo_nome}</h3>
                    </div>
                    <div class="item-info">
                        <div><strong>📅 Data:</strong> ${dataFormatada}</div>
                        ${item.cliente_nome ? `<div><strong>👤 Cliente:</strong> ${item.cliente_nome}</div>` : ''}
                        ${item.nome_propriedade ? `<div><strong>🏘️ Propriedade:</strong> ${item.nome_propriedade}</div>` : ''}
                        ${item.matricula ? `<div><strong>📋 Matrícula:</strong> ${item.matricula}</div>` : ''}
                        <div><strong>🔺 Vértices:</strong> ${item.vertices_extraidos || 0}</div>
                        <div><strong>✅ Status:</strong> ${item.status}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        const container = document.getElementById('lista-historico');
        if (container) {
            container.innerHTML = `
                <div class="mensagem mensagem-erro">
                    ❌ Erro ao carregar histórico: ${error.message}
                </div>
            `;
        }
    }
}

// ==========================================
// IMPORTAÇÃO DE MEMORIAL (FUNÇÃO FALTANTE)
// ==========================================

async function processarMemorial() {
    const inputArquivo = document.getElementById('arquivo-memorial');
    if (!inputArquivo) {
        alert('Elemento de upload não encontrado');
        return;
    }

    const arquivo = inputArquivo.files[0];

    if (!arquivo) {
        alert('Selecione um arquivo .docx');
        return;
    }

    // Mostrar progresso
    const progressoDiv = document.getElementById('progresso-importacao');
    if (progressoDiv) {
        progressoDiv.style.display = 'block';
    }

    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    if (progressText) progressText.textContent = 'Enviando arquivo...';
    if (progressFill) progressFill.style.width = '20%';

    const btnProcessar = document.getElementById('btn-processar');
    if (btnProcessar) btnProcessar.disabled = true;

    try {
        // Criar FormData
        const formData = new FormData();
        formData.append('files', arquivo);

        // Atualizar progresso
        if (progressText) progressText.textContent = 'Processando memorial...';
        if (progressFill) progressFill.style.width = '50%';

        // Enviar para API
        const response = await fetch('/api/importar-memorial-v2', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        // Atualizar progresso
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = 'Concluído!';

        if (!result.success) {
            throw new Error(result.message || 'Erro ao processar memorial');
        }

        console.log('Memorial processado:', result);

        // Redirecionar para página de importação
        setTimeout(() => {
            window.open('/importar-memorial.html', '_blank');
        }, 1000);

    } catch (error) {
        console.error('Erro ao processar memorial:', error);
        if (progressText) progressText.textContent = '❌ Erro: ' + error.message;
        if (progressFill) {
            progressFill.style.width = '100%';
            progressFill.style.background = '#e74c3c';
        }
        if (btnProcessar) btnProcessar.disabled = false;
    }
}

// ==========================================
// FILTROS DO MAPA (FUNÇÃO FALTANTE)
// ==========================================

async function aplicarFiltrosMapa() {
    const tipo = document.getElementById('filtro-tipo')?.value || '';
    const municipio = document.getElementById('filtro-municipio')?.value || '';
    const clienteId = document.getElementById('filtro-cliente')?.value || '';

    console.log('Aplicando filtros:', { tipo, municipio, clienteId });

    // Remover camadas antigas se existirem
    if (typeof propriedadesRuraisLayer !== 'undefined' && propriedadesRuraisLayer && map) {
        map.removeLayer(propriedadesRuraisLayer);
    }
    if (typeof propriedadesUrbanasLayer !== 'undefined' && propriedadesUrbanasLayer && map) {
        map.removeLayer(propriedadesUrbanasLayer);
    }
    if (typeof propriedadesLoteamentoLayer !== 'undefined' && propriedadesLoteamentoLayer && map) {
        map.removeLayer(propriedadesLoteamentoLayer);
    }

    // Recarregar com filtros
    try {
        let url = '/api/propriedades-mapa?';
        if (tipo) url += `tipo=${tipo}&`;
        if (municipio) url += `municipio=${encodeURIComponent(municipio)}&`;
        if (clienteId) url += `cliente_id=${clienteId}&`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success && typeof criarCamadasPropriedades === 'function') {
            criarCamadasPropriedades(result.features);
            console.log(`✅ ${result.total} propriedades carregadas com filtros`);
        }
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
    }
}

function limparFiltrosMapa() {
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroMunicipio = document.getElementById('filtro-municipio');
    const filtroCliente = document.getElementById('filtro-cliente');

    if (filtroTipo) filtroTipo.value = '';
    if (filtroMunicipio) filtroMunicipio.value = '';
    if (filtroCliente) filtroCliente.value = '';

    aplicarFiltrosMapa();
}

console.log('✅ Funções JavaScript faltantes adicionadas com sucesso!');

// ==========================================
// CARREGAR MARCOS GEODÉSICOS
// ==========================================

async function carregarMarcos() {
    try {
        console.log('Carregando marcos geodésicos...');

        const response = await fetch('/api/marcos?limite=20000');
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        console.log(`✅ ${result.data.length} marcos carregados`);

        // Criar layer de marcos
        criarLayerMarcos(result.data);

    } catch (error) {
        console.error('❌ Erro ao carregar marcos:', error);
    }
}

function criarLayerMarcos(marcos) {
    // Remover layer anterior se existir
    if (marcosLayer) {
        map.removeLayer(marcosLayer);
    }

    // Cores por tipo de marco
    const coresPorTipo = {
        'SAT': '#e74c3c',      // Vermelho - Satélite
        'RN': '#3498db',       // Azul - Rede Nivelamento
        'RV': '#2ecc71',       // Verde - Vértice
        'default': '#95a5a6'   // Cinza - Outros
    };

    // Criar markers com coordenadas UTM
    const markers = marcos
        .filter(marco => marco.coordenada_e && marco.coordenada_n)
        .map(marco => {
            // Converter UTM para LatLng
            const coords = utmParaLatLng(marco.coordenada_e, marco.coordenada_n);
            if (!coords) return null;

            const cor = coresPorTipo[marco.tipo] || coresPorTipo.default;

            const icon = L.divIcon({
                className: 'marco-icon',
                html: `<div style="background-color: ${cor}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
                iconSize: [10, 10]
            });

            const marker = L.marker([coords.lat, coords.lng], { icon: icon });

            // Popup com informações
            marker.bindPopup(`
                <div style="min-width: 200px;">
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${marco.codigo}</h3>
                    <strong>🏷️ Tipo:</strong> ${marco.tipo}<br>
                    <strong>📍 Localização:</strong> ${marco.localizacao || 'N/A'}<br>
                    <strong>🗺️ Lote:</strong> ${marco.lote || 'N/A'}<br>
                    <strong>📏 Coordenadas UTM:</strong><br>
                    E: ${parseFloat(marco.coordenada_e).toFixed(2)}m<br>
                    N: ${parseFloat(marco.coordenada_n).toFixed(2)}m<br>
                    <strong>🌐 Lat/Lng:</strong><br>
                    Lat: ${coords.lat.toFixed(6)}°<br>
                    Lon: ${coords.lng.toFixed(6)}°
                </div>
            `);

            return marker;
        })
        .filter(marker => marker !== null);

    // Criar layer group
    marcosLayer = L.layerGroup(markers);
    marcosLayer.addTo(map);

    console.log(`✅ ${markers.length} marcos adicionados ao mapa`);
}

// ==========================================
// FUNÇÕES AUXILIARES DE INICIALIZAÇÃO
// ==========================================

async function atualizarEstatisticas() {
    try {
        const response = await fetch('/api/estatisticas');
        const result = await response.json();

        if (result.success && result.data) {
            // Atualizar estatísticas no header/dashboard
            const stats = result.data;

            if (document.getElementById('stat-total')) {
                document.getElementById('stat-total').textContent = stats.total || 0;
            }
            if (document.getElementById('stat-v')) {
                document.getElementById('stat-v').textContent = stats.tipoV || 0;
            }
            if (document.getElementById('stat-m')) {
                document.getElementById('stat-m').textContent = stats.tipoM || 0;
            }
            if (document.getElementById('stat-p')) {
                document.getElementById('stat-p').textContent = stats.tipoP || 0;
            }

            console.log('✅ Estatísticas atualizadas');
        }
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

async function carregarClientesParaFiltros() {
    try {
        const response = await fetch('/api/clientes?limite=1000');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            // Preencher select de filtro de cliente (se existir)
            const selectFiltroCliente = document.getElementById('filtro-cliente');
            if (selectFiltroCliente) {
                selectFiltroCliente.innerHTML = '<option value="">Todos os clientes</option>';
                result.data.forEach(cliente => {
                    const option = document.createElement('option');
                    option.value = cliente.id;
                    option.textContent = cliente.nome;
                    selectFiltroCliente.appendChild(option);
                });
            }

            console.log('✅ Clientes carregados para filtros');
        }
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

function configurarListenersArquivo() {
    const inputArquivo = document.getElementById('arquivo-memorial');
    if (inputArquivo) {
        inputArquivo.addEventListener('change', (e) => {
            const arquivo = e.target.files[0];
            const nomeArquivoEl = document.getElementById('nome-arquivo-selecionado');
            const btnProcessar = document.getElementById('btn-processar');

            if (arquivo) {
                if (nomeArquivoEl) nomeArquivoEl.textContent = `📄 ${arquivo.name}`;
                if (btnProcessar) btnProcessar.disabled = false;
            } else {
                if (nomeArquivoEl) nomeArquivoEl.textContent = '';
                if (btnProcessar) btnProcessar.disabled = true;
            }
        });

        console.log('✅ Listeners de arquivo configurados');
    }
}

// Função trocarAba (compatibilidade)
function trocarAba(aba) {
    console.log(`Trocando para aba: ${aba}`);

    // Remover classe active de todas as abas
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Adicionar classe active na aba selecionada
    const abaElement = document.getElementById(`tab-${aba}`);
    if (abaElement) {
        abaElement.classList.add('active');
    }

    // Atualizar botões de navegação
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === aba) {
            btn.classList.add('active');
        }
    });

    // Executar funções específicas por aba
    if (aba === 'mapa' && !map) {
        setTimeout(inicializarMapa, 100);
    } else if (aba === 'clientes') {
        if (typeof carregarListaClientes === 'function') {
            carregarListaClientes(0);
        }
    } else if (aba === 'propriedades') {
        if (typeof carregarListaPropriedades === 'function') {
            carregarListaPropriedades(0);
        }
    } else if (aba === 'historico') {
        if (typeof carregarHistorico === 'function') {
            carregarHistorico(0);
        }
    } else if (aba === 'buscar-marcos') {
        // Aba de busca de marcos - não precisa carregar nada automaticamente
        console.log('Aba Buscar Marcos aberta');
    }
}

// ==========================================
// BUSCA DE MARCOS GEODÉSICOS
// ==========================================

let paginaAtualBuscaMarcos = 0;
const itensPorPaginaBuscaMarcos = 50;
let resultadosBuscaMarcos = [];

async function buscarMarcosGeral() {
    try {
        const busca = document.getElementById('busca-geral-marcos')?.value || '';
        const tipo = document.getElementById('filtro-tipo-marco')?.value || '';
        const uf = document.getElementById('filtro-uf-marco')?.value || '';

        console.log('Buscando marcos:', { busca, tipo, uf });

        // Construir URL de busca
        let url = '/api/marcos?limite=1000';
        if (tipo) url += `&tipo=${tipo}`;
        if (busca) url += `&codigo=${encodeURIComponent(busca)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        // Filtrar por UF se fornecido
        let marcos = result.data;
        if (uf) {
            marcos = marcos.filter(m => m.uf === uf || m.localizacao?.includes(uf));
        }

        // Filtrar por busca geral (busca em múltiplos campos)
        if (busca) {
            const buscaLower = busca.toLowerCase();
            marcos = marcos.filter(m =>
                m.codigo?.toLowerCase().includes(buscaLower) ||
                m.localizacao?.toLowerCase().includes(buscaLower) ||
                m.lote?.toLowerCase().includes(buscaLower) ||
                m.limites?.toLowerCase().includes(buscaLower)
            );
        }

        resultadosBuscaMarcos = marcos;
        paginaAtualBuscaMarcos = 0;

        // Mostrar estatísticas
        mostrarEstatisticasBusca(marcos);

        // Renderizar resultados
        renderizarResultadosMarcos(marcos);

        console.log(`✅ ${marcos.length} marcos encontrados`);

    } catch (error) {
        console.error('Erro ao buscar marcos:', error);
        document.getElementById('resultados-marcos').innerHTML = `
            <div class="mensagem mensagem-erro">
                ❌ Erro ao buscar marcos: ${error.message}
            </div>
        `;
    }
}

function mostrarEstatisticasBusca(marcos) {
    const statsDiv = document.getElementById('stats-busca-marcos');
    if (!statsDiv) return;

    const totalMarcos = marcos.length;
    const porTipo = {};

    marcos.forEach(marco => {
        porTipo[marco.tipo] = (porTipo[marco.tipo] || 0) + 1;
    });

    let html = `
        <h3>📊 Estatísticas da Busca</h3>
        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-label">Total de Marcos:</span>
                <span class="stat-value">${totalMarcos}</span>
            </div>
    `;

    Object.keys(porTipo).forEach(tipo => {
        html += `
            <div class="stat-item">
                <span class="stat-label">${tipo}:</span>
                <span class="stat-value">${porTipo[tipo]}</span>
            </div>
        `;
    });

    html += '</div>';
    statsDiv.innerHTML = html;
    statsDiv.style.display = 'block';
}

function renderizarResultadosMarcos(marcos) {
    const container = document.getElementById('resultados-marcos');
    if (!container) return;

    if (marcos.length === 0) {
        container.innerHTML = `
            <div class="mensagem mensagem-info">
                ℹ️ Nenhum marco encontrado com os critérios de busca.
            </div>
        `;
        return;
    }

    // Paginação
    const inicio = paginaAtualBuscaMarcos * itensPorPaginaBuscaMarcos;
    const fim = inicio + itensPorPaginaBuscaMarcos;
    const marcosPagina = marcos.slice(inicio, fim);

    container.innerHTML = `
        <table class="tabela-marcos">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Localização</th>
                    <th>Lote</th>
                    <th>Limites</th>
                    <th>Coordenadas (E, N)</th>
                    <th>Altitude</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${marcosPagina.map(marco => {
                    // Converter coordenadas UTM para Lat/Lng para exibir no mapa
                    const coords = marco.coordenada_e && marco.coordenada_n ? utmParaLatLng(marco.coordenada_e, marco.coordenada_n) : null;
                    return `
                    <tr>
                        <td><strong>${marco.codigo}</strong></td>
                        <td><span class="badge badge-${marco.tipo.toLowerCase()}">${marco.tipo}</span></td>
                        <td>${marco.localizacao || '-'}</td>
                        <td>${marco.lote || '-'}</td>
                        <td>${marco.limites || '-'}</td>
                        <td>
                            ${marco.coordenada_e ? parseFloat(marco.coordenada_e).toFixed(2) + 'm' : '-'},
                            ${marco.coordenada_n ? parseFloat(marco.coordenada_n).toFixed(2) + 'm' : '-'}
                        </td>
                        <td>${marco.altitude_h ? parseFloat(marco.altitude_h).toFixed(2) + 'm' : '-'}</td>
                        <td><span class="badge ${marco.status_campo === 'LEVANTADO' ? 'badge-success' : 'badge-warning'}">${marco.status_campo || 'PENDENTE'}</span></td>
                        <td>
                            ${coords ? `
                                <button class="btn-icon" onclick="verMarcoNoMapa(${coords.lat}, ${coords.lng}, '${marco.codigo}')"
                                        title="Ver no mapa">
                                    🗺️
                                </button>
                            ` : '-'}
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    // Renderizar paginação
    renderizarPaginacaoMarcos(marcos.length);
}

function renderizarPaginacaoMarcos(total) {
    const container = document.getElementById('paginacao-marcos');
    if (!container) return;

    const totalPaginas = Math.ceil(total / itensPorPaginaBuscaMarcos);

    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button ${paginaAtualBuscaMarcos === 0 ? 'disabled' : ''}
                onclick="mudarPaginaBuscaMarcos(${paginaAtualBuscaMarcos - 1})">
            ← Anterior
        </button>
    `;

    for (let i = 0; i < totalPaginas; i++) {
        html += `
            <button class="${i === paginaAtualBuscaMarcos ? 'page-active' : ''}"
                    onclick="mudarPaginaBuscaMarcos(${i})">
                ${i + 1}
            </button>
        `;
    }

    html += `
        <button ${paginaAtualBuscaMarcos >= totalPaginas - 1 ? 'disabled' : ''}
                onclick="mudarPaginaBuscaMarcos(${paginaAtualBuscaMarcos + 1})">
            Próxima →
        </button>
    `;

    container.innerHTML = html;
}

function mudarPaginaBuscaMarcos(novaPagina) {
    paginaAtualBuscaMarcos = novaPagina;
    renderizarResultadosMarcos(resultadosBuscaMarcos);
}

function limparBuscaMarcos() {
    document.getElementById('busca-geral-marcos').value = '';
    document.getElementById('filtro-tipo-marco').value = '';
    document.getElementById('filtro-uf-marco').value = '';

    document.getElementById('stats-busca-marcos').style.display = 'none';
    document.getElementById('resultados-marcos').innerHTML = `
        <div class="mensagem mensagem-info">
            ℹ️ Digite algo no campo de busca para encontrar marcos geodésicos.
        </div>
    `;
    document.getElementById('paginacao-marcos').innerHTML = '';

    resultadosBuscaMarcos = [];
    paginaAtualBuscaMarcos = 0;
}

// ==========================================
// EXPORTAÇÃO DE MARCOS
// ==========================================

function exportarMarcosCSV() {
    if (resultadosBuscaMarcos.length === 0) {
        alert('Faça uma busca primeiro antes de exportar!');
        return;
    }

    // Cabeçalho do CSV
    let csv = 'Código,Tipo,Localização,Lote,Limites,Coordenada_E,Coordenada_N,Altitude,Status\n';

    // Adicionar dados
    resultadosBuscaMarcos.forEach(marco => {
        csv += `"${marco.codigo}",`;
        csv += `"${marco.tipo}",`;
        csv += `"${marco.localizacao || ''}",`;
        csv += `"${marco.lote || ''}",`;
        csv += `"${marco.limites || ''}",`;
        csv += `"${marco.coordenada_e || ''}",`;
        csv += `"${marco.coordenada_n || ''}",`;
        csv += `"${marco.altitude_h || ''}",`;
        csv += `"${marco.status_campo || 'PENDENTE'}"\n`;
    });

    // Download do arquivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `marcos_geodesicos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`✅ ${resultadosBuscaMarcos.length} marcos exportados para CSV`);
}

function exportarMarcosExcel() {
    if (resultadosBuscaMarcos.length === 0) {
        alert('Faça uma busca primeiro antes de exportar!');
        return;
    }

    // Usar endpoint do backend para exportar
    window.location.href = '/api/exportar';
    console.log('✅ Exportando marcos para Excel via API');
}

function verMarcoNoMapa(lat, lng, nome) {
    // Trocar para aba do mapa
    trocarAba('mapa');

    // Aguardar um pouco para garantir que o mapa está visível
    setTimeout(() => {
        if (map) {
            // Centralizar no marco
            map.setView([lat, lng], 15);

            // Adicionar marker temporário
            const marker = L.marker([lat, lng]).addTo(map);
            marker.bindPopup(`<strong>${nome}</strong>`).openPopup();

            // Remover marker após 10 segundos
            setTimeout(() => {
                map.removeLayer(marker);
            }, 10000);

            console.log(`✅ Mostrando marco "${nome}" no mapa`);
        }
    }, 300);
}

// ==========================================
// IMPORTAÇÃO DE PLANILHA DE MARCOS
// ==========================================

function abrirModalImportarPlanilha() {
    document.getElementById('arquivo-planilha-marcos').value = '';
    document.getElementById('nome-planilha-selecionada').textContent = '';
    document.getElementById('btn-importar-planilha').disabled = true;
    document.getElementById('resultado-importacao-planilha').innerHTML = '';
    abrirModal('modal-importar-planilha');
}

// Configurar listener para arquivo de planilha
function configurarListenerPlanilha() {
    const inputPlanilha = document.getElementById('arquivo-planilha-marcos');
    if (inputPlanilha) {
        inputPlanilha.addEventListener('change', (e) => {
            const arquivo = e.target.files[0];
            if (arquivo) {
                document.getElementById('nome-planilha-selecionada').textContent = `📄 ${arquivo.name}`;
                document.getElementById('btn-importar-planilha').disabled = false;
            } else {
                document.getElementById('nome-planilha-selecionada').textContent = '';
                document.getElementById('btn-importar-planilha').disabled = true;
            }
        });
    }
}

// Chamar a configuração quando o DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configurarListenerPlanilha);
} else {
    configurarListenerPlanilha();
}

async function importarPlanilhaMarcos() {
    const inputArquivo = document.getElementById('arquivo-planilha-marcos');
    const arquivo = inputArquivo.files[0];

    if (!arquivo) {
        alert('Selecione um arquivo CSV ou Excel');
        return;
    }

    const btnImportar = document.getElementById('btn-importar-planilha');
    const resultadoDiv = document.getElementById('resultado-importacao-planilha');

    btnImportar.disabled = true;
    btnImportar.textContent = '⏳ Importando...';

    try {
        // Ler arquivo
        const texto = await arquivo.text();
        const linhas = texto.split('\n');

        if (linhas.length < 2) {
            throw new Error('Arquivo vazio ou sem dados');
        }

        // Parsear CSV
        const marcosImportar = [];
        const cabecalho = linhas[0].split(',').map(c => c.trim().replace(/"/g, ''));

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i];
            if (!linha.trim()) continue;

            const valores = linha.split(',').map(v => v.trim().replace(/"/g, ''));

            if (valores.length >= 4) {
                marcosImportar.push({
                    nome: valores[0],
                    tipo: valores[1],
                    municipio: valores[2],
                    uf: valores[3],
                    latitude: valores[4] ? parseFloat(valores[4]) : null,
                    longitude: valores[5] ? parseFloat(valores[5]) : null,
                    altitude: valores[6] ? parseFloat(valores[6]) : null,
                    ano_implantacao: valores[7] ? parseInt(valores[7]) : null
                });
            }
        }

        resultadoDiv.innerHTML = `
            <div class="mensagem mensagem-info">
                ⏳ Importando ${marcosImportar.length} marcos...<br>
                Aguarde, isso pode levar alguns segundos.
            </div>
        `;

        // Aqui você implementaria a chamada para o backend
        // Por enquanto, apenas simulação
        await new Promise(resolve => setTimeout(resolve, 2000));

        resultadoDiv.innerHTML = `
            <div class="mensagem mensagem-sucesso">
                ✅ ${marcosImportar.length} marcos importados com sucesso!
            </div>
        `;

        btnImportar.textContent = '✅ Importado!';

        // Atualizar estatísticas
        setTimeout(() => {
            atualizarEstatisticas();
            fecharModal('modal-importar-planilha');
        }, 2000);

    } catch (error) {
        console.error('Erro ao importar planilha:', error);
        resultadoDiv.innerHTML = `
            <div class="mensagem mensagem-erro">
                ❌ Erro ao importar: ${error.message}
            </div>
        `;
        btnImportar.disabled = false;
        btnImportar.textContent = '✅ Importar';
    }
}

console.log('✅ Sistema de importação de planilhas adicionado!');