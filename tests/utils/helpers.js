/**
 * HELPERS.JS - Utilitários para testes E2E com Playwright
 * Sistema de Gerenciamento de Marcos Geodésicos FHV
 */

/**
 * Aguarda o mapa Leaflet estar completamente carregado
 */
export async function waitForMap(page) {
  await page.waitForSelector('#map', { state: 'visible' });
  await page.waitForTimeout(2000); // Aguarda inicialização do Leaflet
}

/**
 * Aguarda resposta de API específica
 */
export async function waitForAPIResponse(page, url) {
  return page.waitForResponse(response =>
    response.url().includes(url) && response.status() === 200
  );
}

/**
 * Gera dados de memorial descritivo para testes
 */
export function generateTestMemorial() {
  const timestamp = Date.now();
  return {
    cliente: {
      novo: true,
      nome: `Cliente Teste ${timestamp}`,
      tipo_pessoa: 'fisica',
      cpf_cnpj: '12345678901',
      email: `teste${timestamp}@example.com`,
      telefone: '(41) 99999-9999'
    },
    propriedade: {
      nome_propriedade: `Propriedade Teste ${timestamp}`,
      matricula: `TEST-${timestamp}`,
      tipo: 'RURAL',
      municipio: 'Curitiba',
      comarca: 'Curitiba',
      uf: 'PR',
      area_m2: 50000,
      perimetro_m: 900,
      observacoes: 'Memorial descritivo gerado automaticamente para testes E2E'
    },
    vertices: [
      {
        nome: 'M01',
        ordem: 1,
        coordenadas: { e: 680000.00, n: 7175000.00 },
        utm_zona: '22S',
        datum: 'SIRGAS2000'
      },
      {
        nome: 'M02',
        ordem: 2,
        coordenadas: { e: 680500.00, n: 7175000.00 },
        utm_zona: '22S',
        datum: 'SIRGAS2000'
      },
      {
        nome: 'M03',
        ordem: 3,
        coordenadas: { e: 680500.00, n: 7175100.00 },
        utm_zona: '22S',
        datum: 'SIRGAS2000'
      },
      {
        nome: 'M04',
        ordem: 4,
        coordenadas: { e: 680000.00, n: 7175100.00 },
        utm_zona: '22S',
        datum: 'SIRGAS2000'
      }
    ]
  };
}

/**
 * Limpa dados de teste do banco (propriedades e clientes de teste)
 */
export async function clearTestData(baseURL) {
  try {
    // Buscar propriedades de teste
    const propsResponse = await fetch(`${baseURL}/api/propriedades?busca=Teste`);
    const props = await propsResponse.json();

    // Deletar propriedades de teste
    for (const prop of props) {
      await fetch(`${baseURL}/api/propriedades/${prop.id}`, {
        method: 'DELETE'
      });
    }

    // Buscar clientes de teste
    const clientsResponse = await fetch(`${baseURL}/api/clientes?busca=Teste`);
    const clients = await clientsResponse.json();

    // Deletar clientes de teste
    for (const client of clients) {
      await fetch(`${baseURL}/api/clientes/${client.id}`, {
        method: 'DELETE'
      });
    }

    console.log('✅ Dados de teste limpos com sucesso');
  } catch (error) {
    console.error('⚠️  Erro ao limpar dados de teste:', error.message);
  }
}

/**
 * Faz upload de arquivo DOCX de memorial descritivo
 */
export async function uploadMemorialFile(page, filePath) {
  // Aguardar o input de arquivo estar pronto
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);

  // Aguardar processamento
  await page.waitForTimeout(1000);
}

/**
 * Verifica se marcador está visível no mapa
 */
export async function isMarkerVisible(page, markerText) {
  try {
    await page.waitForSelector(`.leaflet-marker-pane`, { state: 'visible', timeout: 5000 });
    const markers = await page.locator('.leaflet-marker-icon').count();
    return markers > 0;
  } catch {
    return false;
  }
}

/**
 * Verifica se polígono está renderizado no mapa
 */
export async function isPolygonVisible(page) {
  try {
    await page.waitForSelector('.leaflet-overlay-pane path', { state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Captura logs de console durante teste
 */
export function setupConsoleCapture(page) {
  const logs = { error: [], warning: [], info: [] };

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      logs.error.push(text);
    } else if (type === 'warning') {
      logs.warning.push(text);
    } else if (type === 'log') {
      logs.info.push(text);
    }
  });

  return logs;
}

/**
 * Aguarda elemento com retry
 */
export async function waitForElementWithRetry(page, selector, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      return true;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await page.waitForTimeout(1000);
    }
  }
  return false;
}

/**
 * Valida estrutura de resposta GeoJSON
 */
export function validateGeoJSON(geojson) {
  if (!geojson || typeof geojson !== 'object') {
    return { valid: false, error: 'GeoJSON inválido ou vazio' };
  }

  if (geojson.type !== 'FeatureCollection') {
    return { valid: false, error: 'Tipo deve ser FeatureCollection' };
  }

  if (!Array.isArray(geojson.features)) {
    return { valid: false, error: 'Features deve ser um array' };
  }

  for (const feature of geojson.features) {
    if (feature.type !== 'Feature') {
      return { valid: false, error: 'Cada item deve ser um Feature' };
    }

    if (!feature.geometry || !feature.properties) {
      return { valid: false, error: 'Feature deve ter geometry e properties' };
    }

    if (feature.geometry.type !== 'Polygon') {
      return { valid: false, error: 'Geometry deve ser Polygon' };
    }
  }

  return { valid: true };
}

/**
 * Extrai coordenadas de um polígono GeoJSON
 */
export function extractCoordinates(geojson) {
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    return [];
  }

  const firstFeature = geojson.features[0];
  return firstFeature.geometry.coordinates[0];
}

/**
 * Calcula área aproximada de polígono (m²)
 */
export function calculatePolygonArea(coordinates) {
  // Fórmula de Shoelace para área de polígono
  let area = 0;
  const n = coordinates.length;

  for (let i = 0; i < n - 1; i++) {
    area += coordinates[i][0] * coordinates[i + 1][1];
    area -= coordinates[i + 1][0] * coordinates[i][1];
  }

  return Math.abs(area / 2);
}

/**
 * Aguarda carregamento completo da aplicação
 */
export async function waitForAppReady(page) {
  await waitForMap(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/**
 * Tira screenshot com nome único
 */
export async function takeScreenshot(page, testInfo, name) {
  const timestamp = Date.now();
  const filename = `${testInfo.title.replace(/\s+/g, '-')}-${name}-${timestamp}.png`;
  await page.screenshot({ path: `tests/screenshots/${filename}`, fullPage: true });
  console.log(`📸 Screenshot salvo: ${filename}`);
}
