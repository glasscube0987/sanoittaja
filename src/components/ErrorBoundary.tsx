import { Component, type ErrorInfo, type ReactNode } from 'react';
import { loadLang, translate, type Key, type Params } from '../lib/i18n';
import { reloadApp } from '../lib/reload';
import { backupFileName, downloadBlob, exportLibrary } from '../lib/sync/exportFile';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  status: string;
}

/**
 * Virheraja koko sovelluksen ympärillä.
 *
 * Ilman tätä yksikin renderöintivirhe purkaa koko puun ja ruutu jää
 * valkoiseksi – eikä valkoisesta ruudusta pääse varmuuskopioon, vaikka laulut
 * ovat kannassa tallessa. Rikkinäinen tietue kannassa on juuri tällainen virhe:
 * se kaataa listan joka kerta kun sovellus avataan.
 *
 * Tärkein asia tässä näkymässä on siksi **varmuuskopio**, ei virheilmoitus.
 * Se lukee kannan suoraan eikä tarvitse kaatunutta käyttöliittymää.
 *
 * Käännös haetaan suoraan eikä kontekstista: konteksti elää sen puun sisällä
 * joka juuri kaatui.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, status: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Sovellus kaatui renderöinnissä', error, info.componentStack);
  }

  private t = (key: Key, params?: Params) => translate(loadLang(), key, params);

  private varmuuskopioi = async () => {
    try {
      this.setState({ status: this.t('list.preparingBackup') });
      downloadBlob(await exportLibrary(), backupFileName());
      this.setState({ status: this.t('list.backupDownloaded') });
    } catch (err) {
      this.setState({
        status: this.t('common.error', { message: err instanceof Error ? err.message : String(err) }),
      });
    }
  };

  render() {
    const { error, status } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="screen crash" role="alert">
        <h1>{this.t('crash.title')}</h1>
        <p>{this.t('crash.text')}</p>
        <div className="button-row">
          <button className="primary" onClick={this.varmuuskopioi}>
            {this.t('crash.backup')}
          </button>
          <button onClick={reloadApp}>{this.t('crash.reload')}</button>
        </div>
        <div className="status">{status}</div>
        {/* Virheen teksti näkyviin: se on ainoa asia jonka käyttäjä voi
            välittää eteenpäin, kun konsolia ei puhelimessa ole. */}
        <pre className="crash-detail">{error.message}</pre>
      </main>
    );
  }
}
