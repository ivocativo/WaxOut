package io.github.ivocativo.waxout;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Schermo intero vero (modalita' "immersiva").
 *
 * PERCHE' ESISTE QUESTO FILE. Capacitor ne genera uno vuoto, che va benissimo per un'app
 * normale ma non per un gioco: dalle segnalazioni dei tester (Galaxy A34, Android 16) i tasti
 * di sistema — home, indietro, app recenti — finivano SOPRA il pulsante di salto e sopra la
 * leva. Toccando per saltare si usciva dal gioco: ingiocabile.
 *
 * La causa non e' Samsung: da Android 15 in poi il sistema disegna l'app A TUTTO SCHERMO,
 * barre comprese ("edge-to-edge"), e non e' piu' facoltativo per le app che puntano a quel
 * livello. Prima di alzare il livello ad Android 15/16 (richiesto da Google Play) il problema
 * non esisteva, perche' il sistema teneva l'app dentro il riquadro libero.
 *
 * Qui le barre si NASCONDONO del tutto, e restano nascoste anche quando si torna nel gioco da
 * una pausa o da una rotazione — per questo c'e' anche onWindowFocusChanged: nasconderle una
 * volta sola all'avvio non basta, ricompaiono al primo cambio di stato della finestra.
 * BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE: se servono, si tirano giu' con una strisciata dal
 * bordo e si rinascondono da sole. Cosi' il tasto "indietro" resta raggiungibile ma non si puo'
 * premere per sbaglio mentre si gioca.
 *
 * ⚠️ Non basta questo da solo: se un domani le barre restassero visibili su un telefono che non
 * conosciamo, i comandi non devono comunque finirci sotto. Se ne occupa `src/touch.js`, che
 * misura lo spazio occupato dalle barre e sposta i comandi verso l'interno. Le due difese sono
 * indipendenti apposta.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        nascondiLeBarre();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) nascondiLeBarre();
    }

    private void nascondiLeBarre() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (c != null) {
            c.hide(WindowInsetsCompat.Type.systemBars());
            c.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }
}
