# Sugerencias para mejorar el Tetris

## 1. Power-ups aleatorios
Cada cierto número de líneas aparece una pieza especial con efecto:
- **Bomba** — destruye un área 3×3
- **Rayo** — limpia fila/columna completa
- **Tinte** — convierte todos los bloques de un color en comodines
- **Gravedad** — compacta huecos del tablero
- **Congelar** — pausa la caída durante 5s

## 2. Piezas nuevas no estándar
Añadir piezas pentominó (de 5 bloques) que aparecen ocasionalmente:
- Pieza `+`
- Pieza `U`
- Pieza `Y`
- Pieza `1×1` (single) como recompensa tras un Tetris
- Pieza `3×3` hueca como reto

## 3. Modo combo y multiplicadores
Sistema de combo encadenado:
- Limpiar líneas en turnos consecutivos multiplica la puntuación (x2, x3, x4...)
- Bonus por **T-spin**
- Bonus por **B2B Tetris**
- Bonus por **Perfect Clear** (dejar el tablero vacío)
- Efectos visuales y sonoros al encadenar

## 4. Modo desafío con objetivos
Niveles con objetivos específicos:
- "Limpia 40 líneas en 2 minutos"
- "Sobrevive con basura subiendo desde abajo cada 10s"
- "Tablero con bloques fijos pre-colocados"
- "Piezas invisibles tras tocar suelo"
- "Rotación inversa en niveles altos"

## 5. Sistema de habilidades cargables
Barra de energía que se llena al limpiar líneas. Al activarla, el jugador elige una habilidad:
- Ver siguientes 5 piezas
- Intercambiar pieza actual por otra del pool
- Ralentizar tiempo 10s
- Deshacer última colocación
- Reservar pieza (hold)


## 6. Sistema de Hold (reservar pieza)
Permitir al jugador guardar la pieza actual en un "bucket" para usarla más tarde:

- **Tecla** — `C` o `Shift` (estándar en Tetris moderno) para enviar la pieza actual al hold
- **Slot de reserva** — panel lateral que muestra la pieza guardada (similar al preview de "next")
- **Intercambio** — si ya hay una pieza en el bucket, al pulsar la tecla se intercambia con la pieza activa
- **Restricción** — solo se puede usar una vez por pieza (bloquear hasta que la pieza actual se asiente), para evitar abusos
- **Indicador visual** — atenuar el slot cuando el hold está bloqueado en el turno actual
- **Estrategia** — útil para reservar la pieza `I` esperando un Tetris, o salvarse de un mal spawn
