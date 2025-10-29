const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3001/api';

test.describe.configure({ mode: 'serial' });

test.describe('Backend API - Validação Completa', () => {

  let clienteId;
  let propriedadeId;

  // ========================================
  // CLIENTES
  // ========================================

  test('1.1 - GET /api/clientes - Listar clientes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/clientes`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBeTruthy();
    expect(Array.isArray(data.data)).toBeTruthy();

    console.log(`✅ ${data.total} clientes encontrados`);
  });

  test('1.2 - POST /api/clientes - Criar cliente', async ({ request }) => {
    const timestamp = Date.now();
    const novoCliente = {
      nome: 'Cliente Teste Playwright',
      tipo_pessoa: 'fisica',
      cpf_cnpj: `${timestamp}`,
      email: `playwright${timestamp}@teste.com`,
      telefone: '(41) 98888-7777'
    };

    const response = await request.post(`${BASE_URL}/clientes`, {
      data: novoCliente
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBeTruthy();
    expect(data.data).toHaveProperty('id');

    clienteId = data.data.id;
    console.log(`✅ Cliente criado: ID ${clienteId}`);
  });

  test('1.3 - PUT /api/clientes/:id - Atualizar cliente', async ({ request }) => {
    expect(clienteId).toBeDefined();

    const response = await request.put(`${BASE_URL}/clientes/${clienteId}`, {
      data: { telefone: '(41) 99999-0000' }
    });

    expect(response.ok()).toBeTruthy();
    console.log(`✅ Cliente atualizado`);
  });

  // ========================================
  // PROPRIEDADES
  // ========================================

  test('2.1 - GET /api/propriedades - Listar propriedades', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/propriedades`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBeTruthy();
    expect(Array.isArray(data.data)).toBeTruthy();

    console.log(`✅ ${data.total} propriedades encontradas`);
  });

  test('2.2 - POST /api/propriedades - Criar propriedade', async ({ request }) => {
    expect(clienteId).toBeDefined();

    const novaPropriedade = {
      nome_propriedade: 'Propriedade Teste Playwright',
      tipo: 'RURAL',
      municipio: 'Campo Largo',
      uf: 'PR',
      area_m2: 100000,
      cliente_id: clienteId
    };

    const response = await request.post(`${BASE_URL}/propriedades`, {
      data: novaPropriedade
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBeTruthy();
    propriedadeId = data.data.id;

    console.log(`✅ Propriedade criada: ID ${propriedadeId}`);
  });

  // ========================================
  // MARCOS
  // ========================================

  test('3.1 - GET /api/marcos - Listar marcos', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/marcos`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(Array.isArray(data.data)).toBeTruthy();
    expect(data).toHaveProperty('total');

    console.log(`✅ ${data.total} marcos encontrados`);
  });

  // ========================================
  // CLEANUP
  // ========================================

  test('9.1 - DELETE /api/propriedades/:id', async ({ request }) => {
    expect(propriedadeId).toBeDefined();

    const response = await request.delete(`${BASE_URL}/propriedades/${propriedadeId}`);
    expect(response.ok()).toBeTruthy();
    console.log(`✅ Propriedade excluída: ID ${propriedadeId}`);
  });

  test('9.2 - DELETE /api/clientes/:id', async ({ request }) => {
    expect(clienteId).toBeDefined();

    const response = await request.delete(`${BASE_URL}/clientes/${clienteId}`);
    expect(response.ok()).toBeTruthy();
    console.log(`✅ Cliente excluído: ID ${clienteId}`);
  });

});
