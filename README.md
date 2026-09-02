# CHN-4 AtoN GIS Viewer | Visualizador Operacional de Auxílios à Navegação

**Centro de Hidrografia do Norte (CHN-4 / 4º Distrito Naval) — Marinha do Brasil**

Aplicação Web GIS tática e visualizador operacional de auxílios à navegação (AtoN) para acompanhamento da sinalização náutica da jurisdição do CHN-4 (Pará, Amapá, Maranhão e rios da Amazônia Oriental).

---

## ⚓ Principais Funcionalidades

- **🗺️ Visualizador GIS Multicamadas**:
  - Satélite Google Maps & Esri World Imagery em alta resolução.
  - Cartas Náuticas Oficiais DHN via WMS / IDEM (Cartas 320, 321, 303, 304, 4011, 4020A, 411, 221, 232).
  - Suporte a cartas locais em GeoTIFF (.tif) com reprojeção em tempo real (Proj4/SIRGAS 2000).
  - Limites de Cartas Eletrônicas (ENC), Zona Econômica Exclusiva (ZEE) e Mar Territorial (12 Milhas).
  - Ferramenta tática de medição de distâncias náuticas (Milhas Náuticas - NM).

- **📊 Monitoramento do Índice de Eficácia (IE - NORMAM-601/DHN)**:
  - Painel telemétrico com IE Mensal e IE Anual Móvel (12 meses).
  - Fórmulas automáticas segundo os artigos 2.48 e 2.49 da NORMAM-601/DHN.
  - Gauge circular em tempo real e detalhamento por classe de sinal (Faróis, Bóias, Balizas).

- **🧭 Planejador de Derrota Náutica & Logística**:
  - Traçado interativo de rotas pelo canal navegável.
  - Cálculo contínuo de rumos verdadeiros, distância total acumulada (NM) e tempo estimado de trânsito (ETA).
  - Exportação direta de waypoints para rota terrestre/viatura no Google Maps.

- **📑 Ficha Técnica (DH2) & Galeria de Fotos**:
  - Consulta aos dados cadastrais da Lista de Faróis (coordenadas GMS e decimais, alcance, altitude, característica da luz).
  - Galeria fotográfica com visualizador Lightbox em alta resolução, zoom óptico, pan e download.
  - Linha do tempo com histórico de manutenções e ocorrências.

- **🔮 Simulador de Manutenção**:
  - Simulação de reparos em sinais avariados com projeção instantânea do ganho percentual no IE.

- **☁️ Sincronização em Tempo Real (Firebase Cloud Firestore)**:
  - Atualização instantânea dos dados da nuvem via Firebase Firestore.

---

## 🚀 Como Publicar no GitHub Pages (1 Clique)

1. Crie um novo repositório no seu GitHub (ex: `chn4-aton-viewer`).
2. Faça o upload ou push de todos os arquivos desta pasta:
   ```bash
   git init
   git add .
   git commit -m "feat: CHN-4 AtoN GIS Viewer"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/chn4-aton-viewer.git
   git push -u origin main
   ```
3. No GitHub, acesse **Settings** > **Pages**.
4. Em **Branch**, selecione `main` / `/(root)` e clique em **Save**.
5. Em instantes o visualizador estará publicado no endereço `https://SEU_USUARIO.github.io/chn4-aton-viewer/`.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3** (Design System militar naval responsivo com temas Dark Navy e Light)
- **Vanilla JavaScript ES6+** (Zero frameworks pesados, alta velocidade e compatibilidade total)
- **Leaflet.js 1.9.4** (Renderização geoespacial interativa e WMS)
- **Proj4js & GeoRaster** (Processamento e reprojeção de GeoTIFF náutico)
- **Firebase Firestore** (Banco de dados NoSQL em tempo real na nuvem)
- **Font Awesome 6 & Google Fonts (Inter & Rajdhani)**

---
*Centro de Hidrografia do Norte — CHN-4 | Marinha do Brasil*
