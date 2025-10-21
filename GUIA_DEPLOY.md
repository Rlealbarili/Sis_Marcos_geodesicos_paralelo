# 🚀 GUIA DE DEPLOY - SISTEMA DE MARCOS GEODÉSICOS

**Versão:** 1.0  
**Data:** Outubro 2025  
**Objetivo:** Colocar o sistema em produção com segurança e estabilidade

---

## 📑 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Opções de Deploy](#opções-de-deploy)
4. [Deploy em Servidor Linux (VPS)](#deploy-em-servidor-linux-vps)
5. [Deploy com Docker](#deploy-com-docker)
6. [Configuração de Domínio](#configuração-de-domínio)
7. [SSL/HTTPS](#ssl-https)
8. [Monitoramento e Logs](#monitoramento-e-logs)
9. [Backup Automático](#backup-automático)
10. [Checklist Pós-Deploy](#checklist-pós-deploy)

---

## 1. VISÃO GERAL

### O Que Vamos Fazer

```
DESENVOLVIMENTO (Local)          PRODUÇÃO (Servidor)
┌────────────────────┐          ┌────────────────────┐
│ Windows/Mac/Linux  │   →→→    │ Servidor Linux VPS │
│ localhost:3000     │          │ seu-dominio.com    │
│ SQLite             │          │ SQLite + PM2       │
└────────────────────┘          └────────────────────┘
```

### Estratégias de Deploy

| Opção | Complexidade | Custo | Recomendado para |
|-------|--------------|-------|------------------|
| **VPS Simples** | ⭐⭐ Média | $5-10/mês | Pequenas equipes |
| **Docker** | ⭐⭐⭐ Alta | $10-20/mês | Deploy escalável |
| **Heroku** | ⭐ Baixa | $7/mês | Prototipação rápida |
| **AWS/Azure** | ⭐⭐⭐⭐ Muito alta | Variável | Empresas grandes |

**Recomendação:** Começar com VPS Simples (DigitalOcean, Linode, ou similar)

---

## 2. PRÉ-REQUISITOS

### Servidor

✅ **Sistema Operacional:** Ubuntu 22.04 LTS (recomendado)  
✅ **RAM:** Mínimo 1GB, recomendado 2GB  
✅ **Disco:** Mínimo 20GB SSD  
✅ **CPU:** 1 core suficiente  
✅ **Rede:** IP público fixo  

### Localmente

✅ **Git** instalado  
✅ **SSH** configurado  
✅ **Projeto** testado e funcionando  

### Opcionais

- Domínio próprio (ex: marcos.cogep.com.br)
- Certificado SSL (Let's Encrypt - gratuito)
- Conta em provedor de nuvem

---

## 3. OPÇÕES DE DEPLOY

### Opção A: VPS Tradicional (RECOMENDADO)

**Provedores:**
- **DigitalOcean** ($6/mês)
- **Linode** ($5/mês)
- **Vultr** ($5/mês)
- **AWS Lightsail** ($3.50/mês)

**Vantagens:**
- ✅ Controle total
- ✅ Previsível
- ✅ Fácil de entender

**Desvantagens:**
- ⚠️ Requer administração Linux
- ⚠️ Você gerencia atualizações

### Opção B: Docker + Cloud

**Provedores:**
- **Heroku** ($7/mês)
- **Railway** ($5/mês)
- **Render** ($7/mês)

**Vantagens:**
- ✅ Deploy automático
- ✅ Menos trabalho de manutenção

**Desvantagens:**
- ⚠️ Menos controle
- ⚠️ Mais caro a longo prazo

---

## 4. DEPLOY EM SERVIDOR LINUX (VPS)

### Passo 1: Criar e Acessar VPS

#### 1.1. Criar Droplet/VPS

No DigitalOcean (exemplo):
1. Criar conta
2. "Create" → "Droplets"
3. Escolher: Ubuntu 22.04 LTS
4. Plano: Basic $6/mês (1GB RAM)
5. Região: Próxima do Brasil (ex: New York)
6. Adicionar SSH key
7. Criar droplet

#### 1.2. Acessar via SSH

```bash
ssh root@SEU_IP_AQUI
```

### Passo 2: Configurar Servidor

#### 2.1. Atualizar Sistema

```bash
apt update && apt upgrade -y
```

#### 2.2. Instalar Node.js

```bash
# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Verificar instalação
node --version  # Deve mostrar v20.x
npm --version   # Deve mostrar 10.x
```

#### 2.3. Instalar PM2 (Gerenciador de Processos)

```bash
npm install -g pm2
```

#### 2.4. Instalar Nginx (Proxy Reverso)

```bash
apt install -y nginx
```

#### 2.5. Criar Usuário do App

```bash
# Criar usuário específico (segurança)
adduser --disabled-password --gecos "" appuser

# Criar diretório do app
mkdir -p /var/www/marcos-geodesicos
chown -R appuser:appuser /var/www/marcos-geodesicos
```

### Passo 3: Enviar Código

#### 3.1. Opção A: Git Clone

```bash
# No servidor
cd /var/www
git clone https://github.com/seu-usuario/marcos-geodesicos.git
cd marcos-geodesicos
chown -R appuser:appuser .
```

#### 3.2. Opção B: SCP (Copiar Local)

```bash
# No seu computador local
cd caminho/para/projeto
tar -czf marcos.tar.gz backend/ frontend/ package.json

# Enviar para servidor
scp marcos.tar.gz root@SEU_IP:/var/www/

# No servidor
cd /var/www
tar -xzf marcos.tar.gz
mv backend frontend package.json marcos-geodesicos/
chown -R appuser:appuser marcos-geodesicos
```

### Passo 4: Instalar Dependências

```bash
cd /var/www/marcos-geodesicos/backend
sudo -u appuser npm install --production
```

### Passo 5: Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env
nano /var/www/marcos-geodesicos/backend/.env
```

Conteúdo:
```env
NODE_ENV=production
PORT=3000
DB_PATH=./database/marcos.db
```

### Passo 6: Iniciar com PM2

```bash
# Como usuário appuser
sudo -u appuser pm2 start /var/www/marcos-geodesicos/backend/server.js \
  --name "marcos-app" \
  --watch \
  --max-memory-restart 300M

# Configurar inicialização automática
pm2 startup systemd -u appuser --hp /home/appuser
pm2 save
```

### Passo 7: Configurar Nginx

```bash
# Criar configuração
nano /etc/nginx/sites-available/marcos-geodesicos
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name SEU_IP_OU_DOMINIO;

    # Logs
    access_log /var/log/nginx/marcos-access.log;
    error_log /var/log/nginx/marcos-error.log;

    # Frontend (arquivos estáticos)
    location / {
        root /var/www/marcos-geodesicos/frontend;
        try_files $uri $uri/ /index.html;
    }

    # API (proxy para Node.js)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Aumentar timeout para importações
    client_max_body_size 50M;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

Ativar configuração:
```bash
ln -s /etc/nginx/sites-available/marcos-geodesicos /etc/nginx/sites-enabled/
nginx -t  # Testar configuração
systemctl restart nginx
```

### Passo 8: Configurar Firewall

```bash
# Permitir HTTP, HTTPS e SSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Passo 9: Testar

```bash
# Ver logs do PM2
pm2 logs marcos-app

# Ver status
pm2 status

# Testar API
curl http://localhost:3000/api/estatisticas

# Testar via IP público
curl http://SEU_IP/api/estatisticas
```

---

## 5. DEPLOY COM DOCKER

### Passo 1: Criar Dockerfile

Criar `Dockerfile` na raiz do projeto:

```dockerfile
# Base image
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar package files
COPY backend/package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expor porta
EXPOSE 3000

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicialização
CMD ["node", "backend/server.js"]
```

### Passo 2: Criar docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./backend/database:/app/backend/database
      - ./backend/backups:/app/backend/backups
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/estatisticas"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped
```

### Passo 3: Build e Deploy

```bash
# Build
docker-compose build

# Iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

---

## 6. CONFIGURAÇÃO DE DOMÍNIO

### Passo 1: Apontar Domínio

No painel do seu provedor de domínio:

```
Tipo: A
Nome: marcos (ou @)
Valor: SEU_IP_PUBLICO
TTL: 3600
```

### Passo 2: Aguardar Propagação

Pode levar de 5 minutos a 48 horas.

Verificar:
```bash
nslookup marcos.cogep.com.br
```

### Passo 3: Atualizar Nginx

```bash
nano /etc/nginx/sites-available/marcos-geodesicos
```

Trocar:
```nginx
server_name SEU_IP;
```

Por:
```nginx
server_name marcos.cogep.com.br;
```

Reiniciar:
```bash
nginx -t && systemctl reload nginx
```

---

## 7. SSL/HTTPS

### Instalar Certbot (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
```

### Gerar Certificado

```bash
certbot --nginx -d marcos.cogep.com.br

# Seguir instruções:
# 1. Digite email
# 2. Aceite termos
# 3. Escolha opção 2 (redirecionar HTTP → HTTPS)
```

### Renovação Automática

```bash
# Testar renovação
certbot renew --dry-run

# Renovação automática já está configurada via cron
```

### Verificar HTTPS

Abra: `https://marcos.cogep.com.br`

---

## 8. MONITORAMENTO E LOGS

### PM2 Monitoring

```bash
# Dashboard em tempo real
pm2 monit

# Logs
pm2 logs marcos-app

# Logs com filtro
pm2 logs marcos-app --lines 100

# Limpar logs antigos
pm2 flush
```

### Nginx Logs

```bash
# Access log
tail -f /var/log/nginx/marcos-access.log

# Error log
tail -f /var/log/nginx/marcos-error.log

# Rotação de logs (já configurado automaticamente)
```

### Monitoring Tools (Opcional)

**PM2 Plus (Gratuito para 1 servidor):**
```bash
pm2 plus
# Seguir instruções para criar conta
```

**New Relic (Trial gratuito):**
```bash
npm install newrelic
# Configurar conforme documentação
```

---

## 9. BACKUP AUTOMÁTICO

### Backup Local Diário

```bash
# Criar script de backup
nano /var/www/scripts/backup-diario.sh
```

Conteúdo:
```bash
#!/bin/bash

DATA=$(date +%Y%m%d)
BACKUP_DIR="/var/www/marcos-geodesicos/backend/backups"
DB_PATH="/var/www/marcos-geodesicos/backend/database/marcos.db"

# Criar backup
cp "$DB_PATH" "$BACKUP_DIR/marcos_auto_$DATA.db"

# Manter apenas últimos 30 dias
find "$BACKUP_DIR" -name "marcos_auto_*.db" -mtime +30 -delete

echo "Backup realizado: marcos_auto_$DATA.db"
```

Tornar executável:
```bash
chmod +x /var/www/scripts/backup-diario.sh
```

### Agendar com Cron

```bash
crontab -e
```

Adicionar:
```cron
# Backup diário às 3h da manhã
0 3 * * * /var/www/scripts/backup-diario.sh >> /var/log/backup-marcos.log 2>&1
```

### Backup Remoto (S3, Dropbox, etc)

```bash
# Instalar AWS CLI
apt install -y awscli

# Configurar credenciais
aws configure

# Script de backup remoto
nano /var/www/scripts/backup-remoto.sh
```

Conteúdo:
```bash
#!/bin/bash

DATA=$(date +%Y%m%d)
DB_PATH="/var/www/marcos-geodesicos/backend/database/marcos.db"
S3_BUCKET="s3://seu-bucket/backups/marcos"

# Upload para S3
aws s3 cp "$DB_PATH" "$S3_BUCKET/marcos_$DATA.db"

echo "Backup remoto realizado"
```

Agendar:
```cron
# Backup remoto semanal (domingo 4h)
0 4 * * 0 /var/www/scripts/backup-remoto.sh >> /var/log/backup-remoto.log 2>&1
```

---

## 10. CHECKLIST PÓS-DEPLOY

### Funcionalidades

- [ ] Sistema acessível via IP/domínio
- [ ] Mapa carrega corretamente
- [ ] API responde (testar `/api/estatisticas`)
- [ ] Consulta funciona
- [ ] Exportar para Excel funciona
- [ ] Performance aceitável (<3s carregamento)

### Segurança

- [ ] HTTPS configurado (SSL válido)
- [ ] Firewall ativo (apenas portas 22, 80, 443)
- [ ] Usuário não-root criado
- [ ] SSH com chave (desabilitar senha)
- [ ] Banco de dados não acessível externamente

### Monitoramento

- [ ] PM2 rodando e auto-restart configurado
- [ ] Logs funcionando (PM2 + Nginx)
- [ ] Alertas configurados (opcional)
- [ ] Backup automático testado

### Documentação

- [ ] Credenciais documentadas (em local seguro)
- [ ] IPs e domínios documentados
- [ ] Procedimentos de recovery documentados

---

## 🎉 DEPLOY CONCLUÍDO!

Seu sistema está agora em produção. Próximos passos:

1. ✅ Compartilhar URL com equipe
2. ✅ Coletar feedback dos usuários
3. ✅ Monitorar logs na primeira semana
4. ✅ Planejar próximas features

---

## 📞 SUPORTE

Em caso de problemas:

1. Verificar logs: `pm2 logs marcos-app`
2. Verificar status: `pm2 status`
3. Testar API: `curl http://localhost:3000/api/estatisticas`
4. Consultar documentação

---

**Versão do Guia:** 1.0  
**Data:** Outubro 2025  
**Próxima revisão:** Após primeiro deploy real
