# RIESCADE - Correção Crônica da Tela de Loading

Este documento detalha o diagnóstico e a solução implementada para corrigir o problema crônico de flashes sem estilo (FOUC) ou tela preta abrupta durante a inicialização dos jogos.

## Diagnóstico do Problema

Quando o usuário solicitava a inicialização de um jogo na gamelist, ocorria o seguinte comportamento:
1. A interface exibia imediatamente o overlay da tela de carregamento (`LaunchScreen.tsx`).
2. O tema de carregamento (`WebThemeRenderer` com `isLaunchingView={true}`) processava o arquivo `loading.html`.
3. Os estilos CSS associados à tela de loading eram requisitados do disco e compilados de forma **assíncrona** (`window.api.getFileContent`).
4. **Flash de Conteúdo Sem Estilo (FOUC):** Durante os milissegundos necessários para carregar o CSS assincronamente, o HTML bruto de `loading.html` era exibido na tela, totalmente desconfigurado.
5. **A "Gambiarra" Anterior:** Para disfarçar o flash unstyled, foi configurado um bloqueio que mantinha a tela totalmente preta até que o CSS terminasse de carregar. Isso resolvia o HTML desconfigurado, mas causava uma tela preta seca e abrupta logo ao apertar Enter, quebrando a sensação de fluidez e transição premium do sistema.
6. **Flash ao Fechar o Jogo:** O temporizador que escurecia a tela de loading estava definido com 10 segundos. Se o jogo demorasse a carregar ou quando o emulador era encerrado, a tela de loading piscava abruptamente de novo porque o estado `isLaunching` demorava 5 segundos para retornar para `false` no retorno ao RIESCADE.

---

## Solução Implementada

Para resolver de maneira elegante e de uma vez por todas, redefinimos o ciclo de vida do carregamento com um padrão de **Pre-loading e Fade-in Reativo**:

### 1. Espera Ativa na Gamelist (Pre-loading Offscreen)
O overlay `LaunchScreen.tsx` agora é renderizado de forma invisível no DOM desde o início do evento de lançamento:
* `opacity: 0`
* `pointer-events: none`

Enquanto isso, a interface visual principal do usuário permanece ativa e com foco no **Gamelist**, dando uma sensação de responsividade imediata.

### 2. Callback `onReady` no `WebThemeRenderer`
Adicionamos o prop opcional `onReady` no renderizador de temas do React:
```typescript
interface Props {
  // ...
  onReady?: () => void
}
```
Um hook de efeito monitora a variável de controle de CSS:
```typescript
useEffect(() => {
  if (cssLoaded && onReady) {
    onReady();
  }
}, [cssLoaded, onReady]);
```
Assim que os arquivos de estilo locais do tema são completamente lidos, compilados e injetados de forma síncrona nos elementos, o `WebThemeRenderer` dispara o callback `onReady()`.

### 3. Transição de Opacidade (Fade-in)
Dentro de `LaunchScreen.tsx`, introduzimos o estado de prontidão:
* `const [isReady, setIsReady] = useState(false)`
* Passamos `onReady={() => setIsReady(true)}` ao renderer.
* Quando `isReady` é disparado, a tela faz um fade-in perfeito sobre a Gamelist com transição CSS:
  ```css
  opacity: isReady ? 1 : 0;
  transition: opacity 0.3s ease;
  ```

### 4. Temporização Inteligente de Retorno
Mudamos o tempo de fade-to-black para **3.5 segundos** iniciando **somente depois** que a tela de loading está 100% pronta.
Quando o jogo termina de rodar e o usuário retorna ao sistema, a tela de loading permanece preta (pois o conteúdo já teve sua opacidade zerada há muito tempo) e desliga de forma limpa, eliminando qualquer flash de carregamento.

---

## Localização das Modificações no Código
1. **[WebThemeRenderer.tsx](file:///c:/tmp/RIESCADE_SYSTEM/emulationstation/.riescade/src/src/renderer/src/components/theme/WebThemeRenderer.tsx)**: Adição do callback do ciclo de vida `onReady`.
2. **[LaunchScreen.tsx](file:///c:/tmp/RIESCADE_SYSTEM/emulationstation/.riescade/src/src/renderer/src/components/LaunchScreen.tsx)**: Orquestração do estado `isReady` e dos efeitos visuais de fade-in e fade-to-black.
