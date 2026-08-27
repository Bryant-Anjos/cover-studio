# Cover Studio

Editor local de imagens para usar como **capa** (cover) no seu site. Roda
inteiro no navegador — nenhuma imagem é enviada para lugar nenhum. O estado e as
imagens ficam salvos no navegador (IndexedDB), então você fecha e reabre de onde
parou.

## Rodar

```bash
pnpm install
pnpm dev            # abre em http://localhost:5180
```

Build estático: `pnpm build` → `dist/`.

## Deploy

`.github/workflows/deploy.yml` publica o `dist/` no **GitHub Pages** a cada push
na `main`. O Pages já está com Source = *GitHub Actions*, então funciona hoje em
**https://bryant-anjos.github.io/cover-studio/**.

Para o domínio próprio `capa.briam.cloud`:

1. DNS de `briam.cloud`: `CNAME capa → bryant-anjos.github.io.`
   (Cloudflare: deixe *DNS only* / nuvem cinza, ou SSL mode *Full* se for proxied.)
2. Settings → Pages → Custom domain: `capa.briam.cloud` → Save; depois marque
   *Enforce HTTPS* quando o certificado ficar pronto.

O `base` é relativo (`vite.config.ts`), então o build serve tanto no domínio
raiz quanto no caminho `/cover-studio/`. É tudo estático — não há back-end.

## Duas ferramentas

### Colagem

- **Dimensões**: predefinições (padrão *Capa do site — 2400 × 1000*) ou largura/altura livres.
- **Cor de fundo / Espaçamento entre painéis / Margem externa**: com espaçamento
  ou margem > 0, abre-se um vão entre os painéis e/ou nas bordas, preenchido com
  a cor de fundo (visual de colagem com moldura). Com ambos em 0, os painéis
  ficam colados e a cor de fundo não aparece.
- **Painéis**: de 2 a 6, separados por **divisores diagonais** configuráveis
  (posição, inclinação, cor, espessura, brilho). Botões *Alternar diagonais* e
  *Distribuir igual*.
- **Imagem por painel**: uma foto em cada painel, com zoom (roda do mouse),
  rotação e arrasto para posicionar. O recorte é a própria forma do painel.
- **Camadas por cima**: quantas imagens quiser sobre a colagem — arrastar para
  mover, cantos para escalar, alça de cima para girar, sliders para recorte,
  opacidade, espelhar, ordem (frente/trás) e duplicar.
- **Exportar**: PNG ou JPG, em 1× / 2× / 3× da dimensão escolhida.

Atalhos: setas movem a seleção (Shift = 10 px), `Delete` remove a camada
selecionada, `[` / `]` mudam a ordem da camada, `Shift` ao girar trava em 15°.

### Logo redonda

Deixa uma logo circular com o **fundo ao redor transparente**. *Detectar
círculo automaticamente* chuta o centro/raio; ajuste fino por arrasto ou
sliders. Controla suavização da borda e margem transparente. Exporta PNG.

## Stack

Vite + React + TypeScript, sem back-end. Canvas 2D para render e export.
