# Sis_Marcos_geodesicos

Sistema completo de gestão de marcos geodésicos com banco de dados SQLite para a COGEP.

---

## 📋 PRÉ-REQUISITOS

1. **Node.js** (versão 16 ou superior)
   - Download: https://nodejs.org/
   - Verifique a instalação: `node --version`

## 🚀 INSTALAÇÃO PASSO A PASSO

### PASSO 1: Criar Estrutura de Pastas

Crie uma pasta chamada `sistema-marcos-geodesicos` e dentro dela crie as seguintes subpastas:
```

sistema-marcos-geodesicos/
├── backend/
├── frontend/
└── database/

````

### PASSO 2: Criar os Arquivos

Coloque cada arquivo na pasta correta:

1. **Na raiz** (`sistema-marcos-geodesicos/`):
   - `package.json`
   - `README.md` (este arquivo)

2. **Na pasta `backend/`**:
   - `server.js`

3. **Na pasta `frontend/`**:
   - `index.html`
   - `styles.css`
   - `script.js`

4. **A pasta `database/`** ficará vazia inicialmente (o banco será criado automaticamente)

### PASSO 3: Instalar Dependências

1. Abra o **Prompt de Comando** (CMD) ou **PowerShell**
2. Navegue até a pasta do projeto:
   ```bash
   cd caminho\para\sistema-marcos-geodesicos
````

3.  Instale as dependências:
    ```bash
    npm install
    ```

Aguarde a instalação de todos os pacotes (express, better-sqlite3, cors, multer, xlsx)

### PASSO 4: Iniciar o Sistema

Ainda no Prompt de Comando, execute:

```bash
npm start
```

Você verá uma mensagem assim:

```
============================================
🚀 SISTEMA DE MARCOS GEODÉSICOS INICIADO!
============================================

📍 Acesso Local: http://localhost:3000
🌐 Acesso na Rede: [http://192.168.](http://192.168.)X.X:3000

💡 Compartilhe o endereço da rede com seus colegas!
============================================
```

### PASSO 5: Acessar o Sistema

1.  **No seu computador**: Abra o navegador e acesse `http://localhost:3000`
2.  **Outros computadores na rede**: Use o IP mostrado no console (ex: `http://192.168.1.100:3000`)

## 📱 COMO USAR O SISTEMA

### Dashboard

  - Visualize estatísticas gerais
  - Veja os marcos cadastrados recentemente
  - Acompanhe o total por tipo (V, M, P)

### Consultar Marcos

  - Use os filtros para buscar marcos específicos
  - Clique em "Ver" para detalhes completos
  - Exclua marcos se necessário

### Cadastrar Marco

  - Preencha o formulário com os dados do marco
  - Campos obrigatórios: Código e Tipo
  - O técnico responsável pode ser informado

### Importar Dados

  - Arraste ou selecione o arquivo Excel
  - O sistema suporta múltiplas planilhas
  - Marcos duplicados são ignorados automaticamente

### Exportar Dados

  - Clique em "Exportar Dados" no menu
  - Baixe todos os marcos em formato Excel
  - Organize por tipo automaticamente

## 🌐 ACESSO NA REDE LOCAL

### Configurar Firewall do Windows

1.  Abra o **Painel de Controle**
2.  Vá em **Sistema e Segurança \> Firewall do Windows Defender**
3.  Clique em **Configurações avançadas**
4.  Clique em **Regras de Entrada \> Nova Regra**
5.  Escolha **Porta** e clique em **Avançar**
6.  Escolha **TCP** e digite **3000** em "Portas locais específicas"
7.  Escolha **Permitir a conexão**
8.  Marque todas as opções (Domínio, Privado, Público)
9.  Dê um nome: "Sistema Marcos Geodésicos"
10. Clique em **Concluir**

### Descobrir o IP do seu Computador

Execute no CMD:

```bash
ipconfig
```

Procure por "Endereço IPv4" na seção da sua rede (geralmente começa com 192.168.X.X)

### Compartilhar o Acesso

Informe aos colegas o endereço:

```
http://SEU_IP:3000
```

Exemplo: `http://192.168.1.100:3000`

## 🔄 MANUTENÇÃO

### Backup do Banco de Dados

O banco de dados está em: `database/marcos.db`

Para fazer backup:

1.  Copie o arquivo `marcos.db`
2.  Guarde em local seguro
3.  Para restaurar, substitua o arquivo

### Atualizar Dados

Use a opção "Importar Dados" do sistema para adicionar múltiplos marcos de uma vez.

### Limpar Dados

Para recomeçar do zero:

1.  Pare o servidor (Ctrl+C no CMD)
2.  Delete o arquivo `database/marcos.db`
3.  Inicie novamente com `npm start`

## ⚙️ EXECUTAR AUTOMATICAMENTE

### Criar Atalho para Iniciar

1.  Crie um arquivo `iniciar.bat` na raiz do projeto
2.  Cole este conteúdo:

<!-- end list -->

```batch
@echo off
cd /d "%~dp0"
start cmd /k npm start
```

3.  Dê duplo clique no arquivo para iniciar o sistema

### Iniciar com o Windows

1.  Pressione `Win + R`
2.  Digite: `shell:startup`
3.  Cole um atalho do arquivo `iniciar.bat` nesta pasta

## 🛠️ SOLUÇÃO DE PROBLEMAS

### Erro: "npm não é reconhecido"

  - Reinstale o Node.js
  - Reinicie o computador

### Erro: "Porta 3000 já está em uso"

  - Outra aplicação está usando a porta
  - Mude a porta no arquivo `server.js` (linha: `const PORT = 3000;`)

### Não consigo acessar da rede

  - Verifique o firewall
  - Confirme que está na mesma rede Wi-Fi
  - Tente usar o IP correto

### Banco de dados corrompido

  - Faça backup dos dados (exportar)
  - Delete `database/marcos.db`
  - Reimporte os dados

## 📞 SUPORTE

Para dúvidas ou problemas:

1.  Verifique este README
2.  Consulte os logs no console
3.  Entre em contato com o suporte técnico

## 📝 NOTAS IMPORTANTES

  - Mantenha o CMD aberto enquanto usar o sistema
  - Faça backups regulares do banco de dados
  - O sistema roda 24/7 se deixar o computador ligado
  - Dados são salvos automaticamente no SQLite

-----

**Desenvolvido para RAFAEL HENRIQUE LEAL BARILI / COGEP
Versão 1.0.0 - 2025
