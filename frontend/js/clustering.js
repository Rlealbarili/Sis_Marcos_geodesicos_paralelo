/**
 * Gerenciador de Clustering com Supercluster
 * Performance 100-200x melhor que Leaflet.markercluster
 */
class ClusterManager {
  constructor(map) {
    this.map = map;
    this.cluster = null;
    this.markers = new L.LayerGroup();
    this.markers.addTo(map);

    // Cores por tipo de marco
    this.colors = {
      'FHV-M': '#E74C3C',
      'FHV-P': '#3498DB',
      'FHV-O': '#2ECC71',
      'SAT': '#9B59B6',
      'RN': '#F39C12',
      'RV': '#1ABC9C',
      'M': '#E74C3C',
      'P': '#3498DB',
      'V': '#2ECC71'
    };

    // Cache de ícones
    this.iconCache = new Map();

    // Configurar Supercluster
    this.initCluster();

    // Bind de métodos
    this.updateClusters = debounce(this.updateClusters.bind(this), 50);

    console.log('✅ ClusterManager inicializado');
  }

  initCluster() {
    // Verificar se Supercluster está disponível
    if (typeof Supercluster === 'undefined') {
      console.error('❌ Supercluster não está carregado! Verifique se o script foi incluído.');
      return;
    }

    try {
      this.cluster = new Supercluster({
        radius: 75,          // raio de agrupamento em pixels
        maxZoom: 18,         // máximo zoom para criar clusters
        minZoom: 0,          // mínimo zoom
        minPoints: 2,        // mínimo de pontos para formar cluster
        extent: 512,         // tile extent
        nodeSize: 64         // tamanho do nó da árvore
      });

      console.log('✅ Supercluster inicializado');
    } catch (error) {
      console.error('❌ Erro ao inicializar Supercluster:', error);
      this.cluster = null;
    }
  }

  loadData(geojson) {
    if (!geojson || !geojson.features) {
      console.error('❌ GeoJSON inválido');
      return;
    }

    // Verificar se cluster está inicializado
    if (!this.cluster) {
      console.error('❌ Supercluster não está inicializado. Não é possível carregar dados.');
      return;
    }

    console.time('⏱️  Supercluster.load');
    this.cluster.load(geojson.features);
    console.timeEnd('⏱️  Supercluster.load');

    console.log(`📍 ${geojson.features.length} pontos carregados no cluster`);

    this.updateClusters();
  }

  updateClusters() {
    // Verificar se cluster está inicializado e tem dados
    if (!this.cluster) {
      console.warn('⚠️  Supercluster não está inicializado. Ignorando updateClusters()');
      return;
    }

    // Verificar se há dados carregados (points é um array interno do Supercluster)
    if (!this.cluster.points || this.cluster.points.length === 0) {
      console.warn('⚠️  Nenhum dado carregado no Supercluster. Ignorando updateClusters()');
      return;
    }

    // Limpar markers atuais
    this.markers.clearLayers();

    // Obter bounds e zoom
    const bounds = this.map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ];
    const zoom = Math.floor(this.map.getZoom());

    // Obter clusters para viewport atual
    console.time('⏱️  getClusters');
    const clusters = this.cluster.getClusters(bbox, zoom);
    console.timeEnd('⏱️  getClusters');

    console.log(`🎯 ${clusters.length} clusters/pontos no viewport (zoom: ${zoom})`);

    // Renderizar clusters e pontos
    clusters.forEach(cluster => {
      const [lng, lat] = cluster.geometry.coordinates;
      const props = cluster.properties;

      if (props.cluster) {
        // É um cluster
        this.createClusterMarker(lat, lng, props);
      } else {
        // É um ponto individual
        this.createPointMarker(lat, lng, cluster.properties);
      }
    });
  }

  createClusterMarker(lat, lng, props) {
    const count = props.point_count;
    const id = props.cluster_id;

    // Determinar tamanho baseado na contagem
    let size, className;
    if (count < 100) {
      size = 40;
      className = 'cluster-small';
    } else if (count < 1000) {
      size = 50;
      className = 'cluster-medium';
    } else {
      size = 60;
      className = 'cluster-large';
    }

    // Criar ícone customizado
    const icon = L.divIcon({
      html: `<div><span>${count.toLocaleString()}</span></div>`,
      className: `marker-cluster ${className}`,
      iconSize: L.point(size, size)
    });

    // Criar marker
    const marker = L.marker([lat, lng], { icon })
      .on('click', () => {
        // Zoom para expandir cluster
        const expansionZoom = this.cluster.getClusterExpansionZoom(id);
        this.map.flyTo([lat, lng], expansionZoom, {
          duration: 0.5
        });
      });

    this.markers.addLayer(marker);
  }

  createPointMarker(lat, lng, props) {
    const tipo = props.tipo || 'default';
    const color = this.colors[tipo] || '#95A5A6';

    // Criar marker como círculo
    const marker = L.circleMarker([lat, lng], {
      radius: 6,
      fillColor: color,
      color: '#fff',
      weight: 1,
      fillOpacity: 0.9
    });

    // Popup
    const popupContent = `
      <div class="marco-popup">
        <h3>${props.nome || props.codigo || 'Marco'}</h3>
        <p><strong>Tipo:</strong> ${props.tipo}</p>
        <p><strong>Município:</strong> ${props.municipio || 'N/A'} ${props.uf ? '- ' + props.uf : ''}</p>
        ${props.altitude ? `<p><strong>Altitude:</strong> ${props.altitude}m</p>` : ''}
      </div>
    `;

    marker.bindPopup(popupContent);

    // Hover effect
    marker.on('mouseover', function() {
      this.setStyle({ radius: 8, weight: 2 });
    });
    marker.on('mouseout', function() {
      this.setStyle({ radius: 6, weight: 1 });
    });

    this.markers.addLayer(marker);
  }

  clear() {
    this.markers.clearLayers();
    console.log('🧹 Clusters limpos');
  }

  getStats() {
    if (!this.cluster) return null;

    const bounds = this.map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ];
    const zoom = Math.floor(this.map.getZoom());
    const clusters = this.cluster.getClusters(bbox, zoom);

    return {
      totalPoints: this.cluster.points?.length || 0,
      visibleClusters: clusters.filter(c => c.properties.cluster).length,
      visiblePoints: clusters.filter(c => !c.properties.cluster).length,
      total: clusters.length
    };
  }
}

// Exportar para uso global
window.ClusterManager = ClusterManager;

console.log('✅ clustering.js carregado');
