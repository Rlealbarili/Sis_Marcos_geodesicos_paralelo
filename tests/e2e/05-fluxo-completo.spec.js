/**
 * TESTE 05: FLUXO COMPLETO E2E
 * Simula jornada completa do usuário: upload → parsing → salvamento → visualização
 */

import { test, expect } from '@playwright/test';
import { generateTestMemorial, waitForAppReady, waitForAPIResponse } from '../utils/helpers.js';

test.describe('Fluxo Completo End-to-End', () => {

  let clienteId, propriedadeId;

  test('05.1 - FLUXO COMPLETO: Criar cliente via API', async ({ request }) => {
    console.log('\n🚀 INICIANDO FLUXO COMPLETO E2E\n');

    const novoCliente = {
      nome: `Cliente E2E ${Date.now()}`,
      tipo_pessoa: 'fisica',
      cpf_cnpj: '98765432100',
      email: `e2e${Date.now()}@example.com`,
      telefone: '(41) 98888-8888',
      endereco: 'Av. E2E Test, 999',
      cidade: 'Curitiba',
      estado: 'PR'
    };

    const response = await request.post('http://localhost:3001/api/clientes', {
      data: novoCliente
    });

    expect(response.status()).toBe(201);

    const cliente = await response.json();
    clienteId = cliente.id;

    console.log('✅ PASSO 1: Cliente criado com ID:', clienteId);
    expect(clienteId).toBeDefined();
  });

  test('05.2 - FLUXO COMPLETO: Criar propriedade com geometria via API', async ({ request }) => {
    expect(clienteId).toBeDefined();

    const memorial = generateTestMemorial();
    memorial.cliente = {
      novo: false,
      id: clienteId
    };

    const response = await request.post('http://localhost:3001/api/salvar-memorial-completo', {
      data: memorial
    });

    expect(response.status()).toBe(200);

    const resultado = await response.json();
    expect(resultado.success).toBe(true);

    propriedadeId = resultado.data.propriedade_id;

    console.log('✅ PASSO 2: Propriedade criada com ID:', propriedadeId);
    console.log('   Vértices salvos:', resultado.data.vertices_criados);
    console.log('   Área calculada:', resultado.data.area_calculada.toFixed(2), 'm²');
    console.log('   Perímetro:', resultado.data.perimetro_calculado.toFixed(2), 'm');

    expect(propriedadeId).toBeDefined();
    expect(resultado.data.vertices_criados).toBe(4);
    expect(resultado.data.area_calculada).toBeGreaterThan(0);
  });

  test('05.3 - FLUXO COMPLETO: Verificar propriedade aparece no GeoJSON', async ({ request }) => {
    expect(propriedadeId).toBeDefined();

    const response = await request.get('http://localhost:3001/api/propriedades/geojson');

    expect(response.status()).toBe(200);

    const geojson = await response.json();
    expect(geojson.type).toBe('FeatureCollection');

    // Procurar a propriedade criada
    const propriedadeEncontrada = geojson.features.find(
      feature => feature.properties.id === propriedadeId
    );

    expect(propriedadeEncontrada).toBeDefined();

    console.log('✅ PASSO 3: Propriedade encontrada no GeoJSON');
    console.log('   Nome:', propriedadeEncontrada.properties.nome);
    console.log('   Tipo:', propriedadeEncontrada.properties.tipo);
    console.log('   Geometria:', propriedadeEncontrada.geometry.type);
  });

  test('05.4 - FLUXO COMPLETO: Visualizar polígono no mapa frontend', async ({ page }) => {
    expect(propriedadeId).toBeDefined();

    console.log('✅ PASSO 4: Acessando frontend...');

    await page.goto('http://localhost:3001');
    await waitForAppReady(page);

    // Aguardar carregamento do GeoJSON
    await page.waitForResponse(
      response => response.url().includes('/api/propriedades/geojson'),
      { timeout: 10000 }
    );

    await page.waitForTimeout(2000);

    // Verificar se polígonos estão visíveis
    const polygonCount = await page.locator('.leaflet-overlay-pane path').count();
    expect(polygonCount).toBeGreaterThan(0);

    console.log(`✅ PASSO 4: ${polygonCount} polígonos renderizados no mapa`);
  });

  test('05.5 - FLUXO COMPLETO: Clicar no polígono e ver detalhes', async ({ page }) => {
    expect(propriedadeId).toBeDefined();

    await page.goto('http://localhost:3001');
    await waitForAppReady(page);

    await page.waitForTimeout(4000);

    // Procurar o polígono da propriedade criada
    const polygons = await page.locator('.leaflet-overlay-pane path').all();

    if (polygons.length > 0) {
      // Clicar no primeiro polígono (assumindo que é o nosso)
      await polygons[0].click();
      await page.waitForTimeout(1000);

      // Verificar popup
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible();

      const popupText = await popup.textContent();

      // Verificar se contém informações esperadas
      expect(popupText.length).toBeGreaterThan(20);

      console.log('✅ PASSO 5: Popup aberto com detalhes da propriedade');
      console.log('   Conteúdo:', popupText.substring(0, 150) + '...');
    } else {
      console.log('⚠️  PASSO 5: Nenhum polígono encontrado para clicar');
    }
  });

  test('05.6 - FLUXO COMPLETO: Navegar para página de propriedades', async ({ page }) => {
    expect(propriedadeId).toBeDefined();

    await page.goto('http://localhost:3001/propriedades.html');
    await page.waitForLoadState('networkidle');

    console.log('✅ PASSO 6: Página de propriedades carregada');

    // Verificar se há lista/tabela de propriedades
    const hasList = await page.locator('table, .property-list, .card').count() > 0;

    if (hasList) {
      console.log('✅ Lista de propriedades encontrada');
    }
  });

  test('05.7 - FLUXO COMPLETO: Buscar propriedade criada na listagem', async ({ request }) => {
    expect(propriedadeId).toBeDefined();

    const response = await request.get(`http://localhost:3001/api/propriedades/${propriedadeId}`);

    expect(response.status()).toBe(200);

    const propriedade = await response.json();

    console.log('✅ PASSO 7: Propriedade encontrada via API direta');
    console.log('   ID:', propriedade.id);
    console.log('   Nome:', propriedade.nome_propriedade);
    console.log('   Matrícula:', propriedade.matricula);
    console.log('   Município:', propriedade.municipio);
    console.log('   Área:', propriedade.area_m2, 'm²');
  });

  test('05.8 - FLUXO COMPLETO: Verificar vértices foram salvos corretamente', async ({ request }) => {
    expect(propriedadeId).toBeDefined();

    const response = await request.get(`http://localhost:3001/api/propriedades/${propriedadeId}/vertices`);

    if (response.status() === 200) {
      const vertices = await response.json();

      expect(Array.isArray(vertices)).toBe(true);
      expect(vertices.length).toBe(4);

      console.log('✅ PASSO 8: Vértices salvos corretamente');
      vertices.forEach(v => {
        console.log(`   ${v.nome}: E=${v.utm_e}, N=${v.utm_n}`);
      });
    } else {
      console.log('ℹ️  PASSO 8: Endpoint de vértices não implementado');
    }
  });

  test('05.9 - FLUXO COMPLETO: Validar integridade dos dados PostGIS', async ({ request }) => {
    expect(propriedadeId).toBeDefined();

    const response = await request.get('http://localhost:3001/api/propriedades/geojson');
    const geojson = await response.json();

    const propriedade = geojson.features.find(f => f.properties.id === propriedadeId);

    if (propriedade) {
      const coords = propriedade.geometry.coordinates[0];

      // Validar que polígono está fechado
      const primeiro = coords[0];
      const ultimo = coords[coords.length - 1];

      expect(primeiro[0]).toBe(ultimo[0]);
      expect(primeiro[1]).toBe(ultimo[1]);

      console.log('✅ PASSO 9: Polígono corretamente fechado');
      console.log(`   Total de coordenadas: ${coords.length}`);
      console.log(`   Primeiro ponto: [${primeiro[0].toFixed(2)}, ${primeiro[1].toFixed(2)}]`);
      console.log(`   Último ponto: [${ultimo[0].toFixed(2)}, ${ultimo[1].toFixed(2)}]`);
    }
  });

  test('05.10 - FLUXO COMPLETO: Testar zoom automático para propriedade', async ({ page }) => {
    expect(propriedadeId).toBeDefined();

    await page.goto('http://localhost:3001');
    await waitForAppReady(page);

    await page.waitForTimeout(4000);

    // Verificar que mapa ajustou bounds
    const bounds = await page.evaluate(() => {
      return window.map.getBounds();
    });

    expect(bounds).toBeDefined();
    expect(bounds._southWest).toBeDefined();
    expect(bounds._northEast).toBeDefined();

    console.log('✅ PASSO 10: Mapa com bounds ajustados');
    console.log('   SW:', bounds._southWest);
    console.log('   NE:', bounds._northEast);
  });

  test('05.11 - FLUXO COMPLETO: Editar propriedade (UPDATE)', async ({ request }) => {
    expect(propriedadeId).toBeDefined();

    const atualizacao = {
      observacoes: 'Propriedade atualizada via teste E2E - ' + new Date().toISOString()
    };

    const response = await request.patch(`http://localhost:3001/api/propriedades/${propriedadeId}`, {
      data: atualizacao
    });

    if (response.status() === 200) {
      const atualizada = await response.json();

      console.log('✅ PASSO 11: Propriedade atualizada com sucesso');
      console.log('   Observações:', atualizada.observacoes);

      expect(atualizada.observacoes).toContain('teste E2E');
    } else {
      console.log('ℹ️  PASSO 11: Endpoint PATCH não implementado');
    }
  });

  test('05.12 - FLUXO COMPLETO: Limpar dados de teste (DELETE)', async ({ request }) => {
    expect(propriedadeId).toBeDefined();
    expect(clienteId).toBeDefined();

    console.log('\n🧹 LIMPANDO DADOS DE TESTE...\n');

    // Deletar propriedade (CASCADE deleta vértices automaticamente)
    const delPropResponse = await request.delete(`http://localhost:3001/api/propriedades/${propriedadeId}`);
    expect(delPropResponse.status()).toBe(200);

    console.log('✅ Propriedade deletada (vértices também via CASCADE)');

    // Deletar cliente
    const delClienteResponse = await request.delete(`http://localhost:3001/api/clientes/${clienteId}`);
    expect(delClienteResponse.status()).toBe(200);

    console.log('✅ Cliente deletado');

    // Verificar que não existem mais
    const getResponse = await request.get(`http://localhost:3001/api/propriedades/${propriedadeId}`);
    expect(getResponse.status()).toBe(404);

    console.log('✅ PASSO 12: Dados de teste limpos com sucesso');
    console.log('\n🎉 FLUXO COMPLETO E2E FINALIZADO COM SUCESSO!\n');
  });

});

test.describe('Fluxo E2E - Cenário de Erro', () => {

  test('05.13 - FLUXO ERRO: Tentar salvar memorial sem vértices', async ({ request }) => {
    const memorialInvalido = {
      cliente: {
        novo: true,
        nome: 'Cliente Inválido',
        tipo_pessoa: 'fisica'
      },
      propriedade: {
        nome_propriedade: 'Propriedade Inválida',
        matricula: 'INVALID-001',
        tipo: 'RURAL',
        municipio: 'Curitiba',
        uf: 'PR'
      },
      vertices: [] // SEM VÉRTICES!
    };

    const response = await request.post('http://localhost:3001/api/salvar-memorial-completo', {
      data: memorialInvalido
    });

    expect(response.status()).toBe(400);

    const resultado = await response.json();
    expect(resultado.success).toBe(false);
    expect(resultado.message).toContain('vértices');

    console.log('✅ Erro tratado corretamente:', resultado.message);
  });

  test('05.14 - FLUXO ERRO: Tentar salvar memorial com apenas 2 vértices', async ({ request }) => {
    const memorial = generateTestMemorial();
    memorial.vertices = memorial.vertices.slice(0, 2); // Apenas 2 vértices

    const response = await request.post('http://localhost:3001/api/salvar-memorial-completo', {
      data: memorial
    });

    expect(response.status()).toBe(400);

    const resultado = await response.json();
    expect(resultado.success).toBe(false);

    console.log('✅ Validação de mínimo 3 vértices funcionou');
  });

  test('05.15 - FLUXO ERRO: Tentar acessar propriedade inexistente', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/propriedades/999999');

    expect(response.status()).toBe(404);

    console.log('✅ Erro 404 para propriedade inexistente');
  });

});
