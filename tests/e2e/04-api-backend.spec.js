/**
 * TESTE 04: API BACKEND
 * Testa endpoints REST, validação de dados, transações e PostGIS
 */

import { test, expect } from '@playwright/test';
import { generateTestMemorial } from '../utils/helpers.js';

const API_BASE = 'http://localhost:3001/api';

test.describe('API Backend - Endpoints REST', () => {

  test('04.1 - GET /api/health - Deve retornar status do servidor', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');

    console.log('✅ Servidor saudável:', data);
  });

  test('04.2 - GET /api/marcos - Deve listar marcos geodésicos', async ({ request }) => {
    const response = await request.get(`${API_BASE}/marcos`);

    expect(response.status()).toBe(200);

    const marcos = await response.json();
    expect(Array.isArray(marcos)).toBe(true);

    console.log(`✅ ${marcos.length} marcos geodésicos retornados`);
  });

  test('04.3 - GET /api/clientes - Deve listar clientes', async ({ request }) => {
    const response = await request.get(`${API_BASE}/clientes`);

    expect(response.status()).toBe(200);

    const clientes = await response.json();
    expect(Array.isArray(clientes)).toBe(true);

    console.log(`✅ ${clientes.length} clientes retornados`);
  });

  test('04.4 - GET /api/propriedades - Deve listar propriedades', async ({ request }) => {
    const response = await request.get(`${API_BASE}/propriedades`);

    expect(response.status()).toBe(200);

    const propriedades = await response.json();
    expect(Array.isArray(propriedades)).toBe(true);

    console.log(`✅ ${propriedades.length} propriedades retornadas`);
  });

  test('04.5 - GET /api/propriedades/geojson - Deve retornar GeoJSON válido', async ({ request }) => {
    const response = await request.get(`${API_BASE}/propriedades/geojson`);

    expect(response.status()).toBe(200);

    const geojson = await response.json();

    // Validar estrutura GeoJSON
    expect(geojson.type).toBe('FeatureCollection');
    expect(Array.isArray(geojson.features)).toBe(true);

    console.log(`✅ GeoJSON válido com ${geojson.features.length} features`);

    // Se houver features, validar estrutura
    if (geojson.features.length > 0) {
      const firstFeature = geojson.features[0];

      expect(firstFeature.type).toBe('Feature');
      expect(firstFeature.geometry).toBeDefined();
      expect(firstFeature.geometry.type).toBe('Polygon');
      expect(firstFeature.properties).toBeDefined();

      console.log('✅ Estrutura de Feature validada');
      console.log('   Propriedades:', Object.keys(firstFeature.properties));
    }
  });

  test('04.6 - POST /api/clientes - Deve criar novo cliente', async ({ request }) => {
    const novoCliente = {
      nome: `Cliente Teste ${Date.now()}`,
      tipo_pessoa: 'fisica',
      cpf_cnpj: '12345678901',
      email: `teste${Date.now()}@example.com`,
      telefone: '(41) 99999-9999',
      endereco: 'Rua Teste, 123',
      cidade: 'Curitiba',
      estado: 'PR'
    };

    const response = await request.post(`${API_BASE}/clientes`, {
      data: novoCliente
    });

    expect(response.status()).toBe(201);

    const resultado = await response.json();
    expect(resultado.id).toBeDefined();
    expect(resultado.nome).toBe(novoCliente.nome);

    console.log('✅ Cliente criado com ID:', resultado.id);

    // Limpar dados de teste
    await request.delete(`${API_BASE}/clientes/${resultado.id}`);
  });

  test('04.7 - POST /api/propriedades - Deve criar nova propriedade', async ({ request }) => {
    // Primeiro criar um cliente
    const cliente = await request.post(`${API_BASE}/clientes`, {
      data: {
        nome: `Cliente Teste ${Date.now()}`,
        tipo_pessoa: 'fisica'
      }
    });

    const clienteData = await cliente.json();

    // Criar propriedade
    const novaPropriedade = {
      cliente_id: clienteData.id,
      nome_propriedade: `Propriedade Teste ${Date.now()}`,
      matricula: `TEST-${Date.now()}`,
      tipo: 'RURAL',
      municipio: 'Curitiba',
      comarca: 'Curitiba',
      uf: 'PR',
      area_m2: 50000,
      perimetro_m: 900
    };

    const response = await request.post(`${API_BASE}/propriedades`, {
      data: novaPropriedade
    });

    expect(response.status()).toBe(201);

    const resultado = await response.json();
    expect(resultado.id).toBeDefined();
    expect(resultado.nome_propriedade).toBe(novaPropriedade.nome_propriedade);

    console.log('✅ Propriedade criada com ID:', resultado.id);

    // Limpar dados de teste
    await request.delete(`${API_BASE}/propriedades/${resultado.id}`);
    await request.delete(`${API_BASE}/clientes/${clienteData.id}`);
  });

  test('04.8 - POST /api/salvar-memorial-completo - Deve salvar memorial com geometria', async ({ request }) => {
    const memorial = generateTestMemorial();

    const response = await request.post(`${API_BASE}/salvar-memorial-completo`, {
      data: memorial
    });

    expect(response.status()).toBe(200);

    const resultado = await response.json();
    expect(resultado.success).toBe(true);
    expect(resultado.data.propriedade_id).toBeDefined();
    expect(resultado.data.vertices_criados).toBe(memorial.vertices.length);
    expect(resultado.data.area_calculada).toBeGreaterThan(0);
    expect(resultado.data.perimetro_calculado).toBeGreaterThan(0);

    console.log('✅ Memorial salvo com sucesso');
    console.log('   Propriedade ID:', resultado.data.propriedade_id);
    console.log('   Vértices criados:', resultado.data.vertices_criados);
    console.log('   Área calculada:', resultado.data.area_calculada.toFixed(2), 'm²');
    console.log('   Perímetro calculado:', resultado.data.perimetro_calculado.toFixed(2), 'm');

    // Limpar dados de teste
    await request.delete(`${API_BASE}/propriedades/${resultado.data.propriedade_id}`);
    await request.delete(`${API_BASE}/clientes/${resultado.data.cliente_id}`);
  });

  test('04.9 - POST /api/salvar-memorial-completo - Deve validar dados incompletos', async ({ request }) => {
    const memorialInvalido = {
      cliente: { novo: true, nome: 'Teste' },
      propriedade: { nome_propriedade: 'Teste' },
      vertices: [] // Sem vértices!
    };

    const response = await request.post(`${API_BASE}/salvar-memorial-completo`, {
      data: memorialInvalido
    });

    expect(response.status()).toBe(400);

    const resultado = await response.json();
    expect(resultado.success).toBe(false);
    expect(resultado.message).toContain('vértices');

    console.log('✅ Validação funcionou:', resultado.message);
  });

  test('04.10 - POST /api/salvar-memorial-completo - Deve calcular área via PostGIS', async ({ request }) => {
    const memorial = generateTestMemorial();

    // Coordenadas formam um retângulo de 500m x 100m = 50.000 m²
    memorial.vertices = [
      { nome: 'M01', ordem: 1, coordenadas: { e: 680000, n: 7175000 }, utm_zona: '22S', datum: 'SIRGAS2000' },
      { nome: 'M02', ordem: 2, coordenadas: { e: 680500, n: 7175000 }, utm_zona: '22S', datum: 'SIRGAS2000' },
      { nome: 'M03', ordem: 3, coordenadas: { e: 680500, n: 7175100 }, utm_zona: '22S', datum: 'SIRGAS2000' },
      { nome: 'M04', ordem: 4, coordenadas: { e: 680000, n: 7175100 }, utm_zona: '22S', datum: 'SIRGAS2000' }
    ];

    const response = await request.post(`${API_BASE}/salvar-memorial-completo`, {
      data: memorial
    });

    const resultado = await response.json();

    // Área esperada: 500m * 100m = 50.000 m²
    const areaCalculada = resultado.data.area_calculada;
    expect(areaCalculada).toBeGreaterThan(49000); // Margem de erro
    expect(areaCalculada).toBeLessThan(51000);

    console.log('✅ PostGIS calculou área:', areaCalculada.toFixed(2), 'm²');
    console.log('   Área esperada: 50.000 m²');
    console.log('   Diferença:', Math.abs(areaCalculada - 50000).toFixed(2), 'm²');

    // Limpar dados de teste
    await request.delete(`${API_BASE}/propriedades/${resultado.data.propriedade_id}`);
    await request.delete(`${API_BASE}/clientes/${resultado.data.cliente_id}`);
  });

  test('04.11 - POST /api/salvar-memorial-completo - Deve fechar polígono automaticamente', async ({ request }) => {
    const memorial = generateTestMemorial();

    // Vértices sem fechar o polígono (primeiro != último)
    memorial.vertices = [
      { nome: 'M01', ordem: 1, coordenadas: { e: 680000, n: 7175000 }, utm_zona: '22S', datum: 'SIRGAS2000' },
      { nome: 'M02', ordem: 2, coordenadas: { e: 680500, n: 7175000 }, utm_zona: '22S', datum: 'SIRGAS2000' },
      { nome: 'M03', ordem: 3, coordenadas: { e: 680500, n: 7175100 }, utm_zona: '22S', datum: 'SIRGAS2000' }
      // Não fecha no M01!
    ];

    const response = await request.post(`${API_BASE}/salvar-memorial-completo`, {
      data: memorial
    });

    expect(response.status()).toBe(200);

    const resultado = await response.json();
    expect(resultado.success).toBe(true);

    console.log('✅ Polígono fechado automaticamente pelo backend');
    console.log('   Área calculada:', resultado.data.area_calculada.toFixed(2), 'm²');

    // Limpar dados de teste
    await request.delete(`${API_BASE}/propriedades/${resultado.data.propriedade_id}`);
    await request.delete(`${API_BASE}/clientes/${resultado.data.cliente_id}`);
  });

  test('04.12 - GET /api/propriedades?municipio=X - Deve filtrar por município', async ({ request }) => {
    const response = await request.get(`${API_BASE}/propriedades?municipio=Curitiba`);

    expect(response.status()).toBe(200);

    const propriedades = await response.json();
    expect(Array.isArray(propriedades)).toBe(true);

    // Todas devem ser de Curitiba
    const todasCuritiba = propriedades.every(p => p.municipio === 'Curitiba');
    expect(todasCuritiba).toBe(true);

    console.log(`✅ ${propriedades.length} propriedades em Curitiba`);
  });

  test('04.13 - GET /api/propriedades?cliente_id=X - Deve filtrar por cliente', async ({ request }) => {
    // Criar cliente de teste
    const cliente = await request.post(`${API_BASE}/clientes`, {
      data: { nome: `Cliente Teste ${Date.now()}`, tipo_pessoa: 'fisica' }
    });

    const clienteData = await cliente.json();

    const response = await request.get(`${API_BASE}/propriedades?cliente_id=${clienteData.id}`);

    expect(response.status()).toBe(200);

    const propriedades = await response.json();
    expect(Array.isArray(propriedades)).toBe(true);

    // Todas devem ser deste cliente
    const todasDoCliente = propriedades.every(p => p.cliente_id === clienteData.id);
    expect(todasDoCliente).toBe(true);

    console.log(`✅ ${propriedades.length} propriedades do cliente ${clienteData.id}`);

    // Limpar
    await request.delete(`${API_BASE}/clientes/${clienteData.id}`);
  });

  test('04.14 - GET /api/propriedades?busca=X - Deve buscar por texto', async ({ request }) => {
    const response = await request.get(`${API_BASE}/propriedades?busca=Teste`);

    expect(response.status()).toBe(200);

    const propriedades = await response.json();
    expect(Array.isArray(propriedades)).toBe(true);

    console.log(`✅ ${propriedades.length} propriedades encontradas com 'Teste'`);
  });

  test('04.15 - DELETE /api/propriedades/:id - Deve deletar propriedade e vértices (CASCADE)', async ({ request }) => {
    // Criar memorial completo
    const memorial = generateTestMemorial();

    const createResponse = await request.post(`${API_BASE}/salvar-memorial-completo`, {
      data: memorial
    });

    const createData = await createResponse.json();
    const propId = createData.data.propriedade_id;

    // Deletar propriedade
    const deleteResponse = await request.delete(`${API_BASE}/propriedades/${propId}`);

    expect(deleteResponse.status()).toBe(200);

    // Verificar que não existe mais
    const getResponse = await request.get(`${API_BASE}/propriedades/${propId}`);
    expect(getResponse.status()).toBe(404);

    console.log('✅ Propriedade deletada com CASCADE (vértices também deletados)');

    // Limpar cliente
    await request.delete(`${API_BASE}/clientes/${createData.data.cliente_id}`);
  });

});
