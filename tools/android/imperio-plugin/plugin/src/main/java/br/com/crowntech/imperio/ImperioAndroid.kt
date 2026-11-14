package br.com.crowntech.imperio

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import org.godotengine.godot.Godot
import org.godotengine.godot.plugin.GodotPlugin
import org.godotengine.godot.plugin.SignalInfo
import org.godotengine.godot.plugin.UsedByGodot

/**
 * Plugin Android do Império de Bolso (ADR 0032).
 *  - googleSignIn(webClientId): abre o "Entrar com Google" do sistema (Credential Manager) e
 *    devolve o ID token (o servidor valida e vincula a conta). Sinais: google_id_token(token)
 *    ou google_sign_in_failed(motivo) — motivo "cancelled" quando o jogador fecha a folha.

 *  - checkForUpdate(): atualização dentro do app do Google Play (tela cheia: baixa, instala e
 *    reinicia o jogo). Sinais: update_started ou update_not_available(motivo). Se o jogador
 *    sair no meio, a atualização volta ao reabrir o jogo.
 * O compartilhar da posição usa a página do servidor (folha nativa pelo navegador), sem plugin.
 */
class ImperioAndroid(godot: Godot) : GodotPlugin(godot) {

    override fun getPluginName() = "ImperioAndroid"

    override fun getPluginSignals(): MutableSet<SignalInfo> = mutableSetOf(
        SignalInfo("google_id_token", String::class.java),
        SignalInfo("google_sign_in_failed", String::class.java),
        SignalInfo("update_started"),
        SignalInfo("update_not_available", String::class.java),
    )

    private val updateRequest = 7301

    @UsedByGodot
    fun checkForUpdate() {
        val act = activity ?: return emitSignal("update_not_available", "no_activity")
        val manager = AppUpdateManagerFactory.create(act)
        manager.appUpdateInfo
            .addOnSuccessListener { info ->
                val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                if (available && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    manager.startUpdateFlowForResult(
                        info, act, AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE), updateRequest,
                    )
                    emitSignal("update_started")
                } else {
                    emitSignal("update_not_available", "availability=${info.updateAvailability()}")
                }
            }
            .addOnFailureListener { e -> emitSignal("update_not_available", e.toString()) }
    }

    /** Atualização em tela cheia interrompida (jogador saiu do app): retoma ao voltar. */
    override fun onMainResume() {
        super.onMainResume()
        val act = activity ?: return
        val manager = AppUpdateManagerFactory.create(act)
        manager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                manager.startUpdateFlowForResult(
                    info, act, AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE), updateRequest,
                )
            }
        }
    }

    @UsedByGodot
    fun googleSignIn(webClientId: String) {
        val act = activity ?: return emitSignal("google_sign_in_failed", "no_activity")
        val option = GetSignInWithGoogleOption.Builder(webClientId).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val result = CredentialManager.create(act).getCredential(act, request)
                val cred = result.credential
                if (cred is CustomCredential &&
                    cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    val token = GoogleIdTokenCredential.createFrom(cred.data).idToken
                    emitSignal("google_id_token", token)
                } else {
                    emitSignal("google_sign_in_failed", "unexpected_credential")
                }
            } catch (e: GetCredentialCancellationException) {
                emitSignal("google_sign_in_failed", "cancelled")
            } catch (e: GetCredentialException) {
                emitSignal("google_sign_in_failed", "${e.type}: ${e.message}")
            } catch (e: Exception) {
                emitSignal("google_sign_in_failed", e.toString())
            }
        }
    }
}
