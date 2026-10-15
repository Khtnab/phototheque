import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Image, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, Text, TextInput, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';

/* ---------- Réglages et outils ---------- */
const KEY = 'phototheque:v1';
const INBOX = 'Captures rapides';
// Le raccourci flottant n'existe que dans la version installable Android (pas dans Expo Go, ni sur iPhone ou le web).
const QC = requireOptionalNativeModule('QuickCapture');
const light = { bg: '#f3f5f6', card: '#ffffff', ink: '#16212a', mut: '#66727c', acc: '#0d6b70', on: '#ffffff', line: '#d5dde1', bad: '#b3261e' };
const dark = { bg: '#0f161b', card: '#18232b', ink: '#e8eef1', mut: '#92a1ab', acc: '#46bdb5', on: '#06201f', line: '#2a3944', bad: '#ff8a80' };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fld = (C) => ({ backgroundColor: C.card, color: C.ink, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 12 });
// On ne garde que le nom du fichier : le dossier de l'appli peut changer d'adresse.
const uriOf = (it) => (it.file ? new File(Paths.document, it.file).uri : it.uri);

// Copie un fichier dans le stockage durable de l'appli (adresse d'origine en secours).
async function keepFile(src, ext) {
  const file = `${uid()}.${ext}`;
  try {
    await new File(src).copy(new File(Paths.document, file));
    return { file };
  } catch (e) {
    return { uri: src };
  }
}
async function dropFile(it) {
  try {
    if (it.file) await new File(Paths.document, it.file).delete();
  } catch (e) {}
}
// Photo prête à l'emploi : orientation corrigée, 1600 px maximum, JPEG.
// `fn` applique une retouche (rotation, recadrage) à la place du simple redimensionnement.
async function prepare(uri, fn, max = 1600) {
  const src = await ImageManipulator.manipulate(uri).renderAsync();
  const ctx = ImageManipulator.manipulate(src);
  if (fn) fn(ctx);
  else if (Math.max(src.width, src.height) > max) ctx.resize(src.width >= src.height ? { width: max } : { height: max });
  const r = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.88 });
  return { ...(await keepFile(r.uri, 'jpg')), w: r.width, h: r.height };
}

/* ---------- Petits composants ---------- */
function Btn({ C, t, onPress, pri, bad, flex }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: pri ? C.acc : C.card, borderColor: pri ? C.acc : C.line, borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', flex: flex ? 1 : undefined }}>
      <Text style={{ color: pri ? C.on : bad ? C.bad : C.ink, fontWeight: pri ? '700' : '500', textAlign: 'center' }}>{t}</Text>
    </Pressable>
  );
}

function Vid({ uri }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} nativeControls style={{ width: '100%', height: 300, backgroundColor: '#000' }} />;
}

function Viewer({ C, it, themes, busy, onClose, onPatch, onEdit, onMove, onDelete }) {
  const [cap, setCap] = useState(it.cap || '');
  const [txt, setTxt] = useState(it.txt || '');
  const isText = it.type === 'text';
  const uri = isText ? null : uriOf(it);
  const save = () => onPatch(it, isText ? { txt } : { cap });
  const edit = (fn) => {
    save();
    onEdit(it, fn);
  };
  const crop = (r) =>
    edit((ctx) => {
      const wide = it.w / it.h > r;
      const cw = Math.round(wide ? it.h * r : it.w);
      const ch = Math.round(wide ? it.h : it.w / r);
      ctx.crop({ originX: Math.round((it.w - cw) / 2), originY: Math.round((it.h - ch) / 2), width: cw, height: ch });
    });
  const close = () => {
    if (isText && !txt.trim()) return onDelete();
    save();
    onClose();
  };
  const others = themes.filter((t) => t.id !== it.theme);
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
            <Btn C={C} t="Fermer" onPress={close} />
            <Text style={{ color: C.acc }}>{busy}</Text>
            {isText ? <View /> : <Btn C={C} t="Partager" onPress={() => Sharing.shareAsync(uri).catch(() => {})} />}
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }} keyboardShouldPersistTaps="handled">
            {isText ? (
              <TextInput value={txt} onChangeText={setTxt} placeholder="Écris ta note…" placeholderTextColor={C.mut} multiline autoFocus={!it.txt} style={[fld(C), { minHeight: 220, textAlignVertical: 'top', fontSize: 16 }]} />
            ) : it.type === 'video' ? (
              <Vid uri={uri} />
            ) : (
              <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', aspectRatio: (it.w || 4) / (it.h || 3), backgroundColor: '#000' }} />
            )}
            {it.type === 'photo' && (
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn flex C={C} t="⟲ 90°" onPress={() => edit((c) => c.rotate(-90))} />
                  <Btn flex C={C} t="⟳ 90°" onPress={() => edit((c) => c.rotate(90))} />
                </View>
                <Text style={{ color: C.mut }}>Recadrer au centre</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9]].map(([n, r]) => (
                    <Btn key={n} flex C={C} t={n} onPress={() => crop(r)} />
                  ))}
                </View>
              </>
            )}
            {!isText && (
              <TextInput value={cap} onChangeText={setCap} onEndEditing={() => onPatch(it, { cap })} placeholder="Légende (reprise dans le PDF)" placeholderTextColor={C.mut} multiline style={[fld(C), { minHeight: 48 }]} />
            )}
            {others.length > 0 && (
              <>
                <Text style={{ color: C.mut }}>Déplacer vers un autre thème</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {others.map((t) => (
                    <Btn key={t.id} C={C} t={t.name} onPress={() => { save(); onMove(it, t.id); }} />
                  ))}
                </ScrollView>
              </>
            )}
            <Btn
              C={C}
              bad
              t="Supprimer"
              onPress={() =>
                Alert.alert('Supprimer ?', 'Cette action est définitive.', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: onDelete },
                ])
              }
            />
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

/* ---------- Application ---------- */
export default function App() {
  const C = useColorScheme() === 'dark' ? dark : light;
  const { width } = useWindowDimensions();
  const [db, setDb] = useState(null);
  const [cur, setCur] = useState(null);
  const [sel, setSel] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [qcOn, setQcOn] = useState(false);
  const ref = useRef(null);
  const importing = useRef(false);
  const get = () => ref.current;

  const commit = (d) => {
    ref.current = d;
    setDb(d);
    AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => Alert.alert('Enregistrement impossible'));
  };

  useEffect(() => {
    (async () => {
      let d = { themes: [], items: [] };
      try {
        d = JSON.parse(await AsyncStorage.getItem(KEY)) || d;
      } catch (e) {}
      if (!d.themes.length) d.themes.push({ id: uid(), name: 'Général' });
      ref.current = d;
      setDb(d);
      setCur(d.themes[0].id);
      setQcOn(!!(QC && QC.isRunning()));
      importInbox();
    })();
    // Au retour dans l'appli : récupérer les captures faites depuis la barre flottante.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && ref.current) {
        setQcOn(!!(QC && QC.isRunning()));
        importInbox();
      }
    });
    return () => sub.remove();
  }, []);

  /* Captures rapides : tout ce que la barre flottante a enregistré arrive dans le thème « Captures rapides » */
  async function importInbox() {
    if (importing.current) return;
    importing.current = true;
    try {
      let files = [];
      try {
        files = new Directory(Paths.document, 'inbox').list().filter((f) => f instanceof File && f.size);
      } catch (e) {
        return;
      }
      if (!files.length) return;
      setBusy('Import des captures rapides…');
      const first = get();
      const theme = first.themes.find((t) => t.name === INBOX) || { id: uid(), name: INBOX };
      const added = [];
      for (const f of files) {
        try {
          const ext = (f.extension || '').replace('.', '').toLowerCase();
          const base = { id: uid(), theme: theme.id, cap: '', ts: parseInt(f.name, 10) || Date.now() };
          // « _s » dans le nom = capture d'écran : on garde plus de définition pour que le texte reste lisible.
          if (ext === 'jpg') added.push({ ...base, type: 'photo', ...(await prepare(f.uri, undefined, f.name.includes('_s') ? 2600 : 1600)) });
          else if (ext === 'mp4') added.push({ ...base, type: 'video', ...(await keepFile(f.uri, 'mp4')) });
          else if (ext === 'txt') added.push({ ...base, type: 'text', txt: await f.text() });
          else continue;
          f.delete();
        } catch (e) {}
      }
      if (added.length) {
        const d = get();
        commit({ ...d, themes: d.themes.some((t) => t.id === theme.id) ? d.themes : [...d.themes, theme], items: [...d.items, ...added] });
        setCur(theme.id);
      }
    } finally {
      setBusy('');
      importing.current = false;
    }
  }

  /* Raccourci flottant (Android, version installable) */
  async function toggleQuick() {
    if (!QC) {
      return Alert.alert(
        'Raccourci flottant',
        Platform.OS === 'android'
          ? 'Il est disponible dans la version installable de l’appli pour Android, pas dans Expo Go.'
          : 'Ce raccourci n’est possible que sur Android : Apple n’autorise pas les boutons flottants au-dessus des autres applis.'
      );
    }
    if (qcOn) {
      QC.stop();
      return setQcOn(false);
    }
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) return Alert.alert('Accès à l’appareil photo refusé', 'Autorise-le dans les réglages du téléphone.');
    if (Platform.OS === 'android' && Platform.Version >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (!QC.canDraw()) {
      return Alert.alert('Autorisation nécessaire', 'Active « Afficher par-dessus les autres applis » pour Photothèque, puis reviens ici et réessaie.', [
        { text: 'Ouvrir les réglages', onPress: () => QC.openOverlaySettings() },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
    QC.start();
    setQcOn(true);
    Alert.alert('Raccourci activé', 'Quitte l’appli : la barre apparaît sur le bord droit de l’écran. Touche ✕ pour la retirer. Tes captures arrivent dans « ' + INBOX + ' ».');
  }

  /* Ajout de médias */
  async function addAssets(assets) {
    setBusy('Traitement…');
    const added = [];
    for (const a of assets) {
      try {
        const vid = a.type === 'video';
        const f = vid ? await keepFile(a.uri, (a.uri.split('.').pop() || 'mp4').slice(0, 4)) : await prepare(a.uri);
        added.push({ id: uid(), theme: cur, type: vid ? 'video' : 'photo', cap: '', ts: Date.now() + added.length, ...f, w: f.w ?? a.width, h: f.h ?? a.height });
      } catch (e) {
        Alert.alert('Fichier illisible');
      }
    }
    commit({ ...get(), items: [...get().items, ...added] });
    setBusy('');
    return added;
  }
  async function shoot(kind) {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return Alert.alert('Accès à l’appareil photo refusé', 'Autorise-le dans les réglages du téléphone.');
    const r = await ImagePicker.launchCameraAsync(
      kind === 'video' ? { mediaTypes: ['videos'], videoMaxDuration: 600 } : { mediaTypes: ['images'], allowsEditing: true, quality: 1 }
    );
    if (r.canceled) return;
    const [it] = await addAssets(r.assets);
    if (it && it.type === 'photo') setSel(it.id);
  }
  async function pick() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 1 });
    if (!r.canceled) await addAssets(r.assets);
  }
  function addNote() {
    const n = { id: uid(), theme: cur, type: 'text', txt: '', cap: '', ts: Date.now() };
    commit({ ...get(), items: [...get().items, n] });
    setSel(n.id);
  }

  /* Retouche, légende, déplacement, suppression */
  async function onEdit(it, fn) {
    setBusy('Traitement…');
    try {
      const f = await prepare(uriOf(it), fn);
      await dropFile(it);
      const latest = get().items.find((x) => x.id === it.id) || it;
      const next = { ...latest, file: f.file, uri: f.uri, w: f.w, h: f.h };
      commit({ ...get(), items: get().items.map((x) => (x.id === it.id ? next : x)) });
    } catch (e) {
      Alert.alert('Modification impossible', String((e && e.message) || e));
    }
    setBusy('');
  }
  const onPatch = (it, patch) => {
    const now = get().items.find((x) => x.id === it.id);
    if (now && Object.keys(patch).some((k) => now[k] !== patch[k])) commit({ ...get(), items: get().items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)) });
  };
  const onMove = (it, theme) => {
    commit({ ...get(), items: get().items.map((x) => (x.id === it.id ? { ...x, theme } : x)) });
    setSel(null);
  };
  async function onDelete(it) {
    await dropFile(it);
    commit({ ...get(), items: get().items.filter((x) => x.id !== it.id) });
    setSel(null);
  }

  /* Thèmes */
  function addTheme() {
    const n = name.trim().slice(0, 40);
    if (!n) return;
    const t = { id: uid(), name: n };
    commit({ ...get(), themes: [...get().themes, t] });
    setCur(t.id);
    setName('');
  }
  function removeTheme() {
    const t = get().themes.find((x) => x.id === cur);
    Alert.alert(`Supprimer « ${t.name} » ?`, 'Toutes les photos, vidéos et notes de ce thème seront supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const d = get();
          await Promise.all(d.items.filter((i) => i.theme === cur).map(dropFile));
          const themes = d.themes.filter((x) => x.id !== cur);
          if (!themes.length) themes.push({ id: uid(), name: 'Général' });
          commit({ themes, items: d.items.filter((i) => i.theme !== cur) });
          setCur(themes[0].id);
        },
      },
    ]);
  }

  /* Export PDF du thème : une photo ou une note par page, avec sa légende */
  async function exportPdf() {
    const t = get().themes.find((x) => x.id === cur);
    const ps = get().items.filter((i) => i.theme === cur && i.type !== 'video').sort((a, b) => a.ts - b.ts);
    setBusy('Création du PDF…');
    try {
      let pages = '';
      for (const p of ps) {
        if (p.type === 'text') {
          pages += `<section><h1>${esc(t.name)}</h1><div class="note">${esc(p.txt)}</div></section>`;
        } else {
          const b64 = await new File(uriOf(p)).base64();
          pages += `<section><h1>${esc(t.name)}</h1><img src="data:image/jpeg;base64,${b64}"/><p>${esc(p.cap)}</p></section>`;
        }
      }
      const html = `<html><head><meta charset="utf-8"><style>body{font-family:Helvetica,Arial,sans-serif;margin:0}h1{font-size:13px;color:#555;margin:0 0 8px}section{page-break-after:always}img{max-width:100%;max-height:235mm;display:block;margin:0 auto}p{font-size:14px}.note{white-space:pre-wrap;font-size:15px;line-height:1.5}</style></head><body>${pages}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch (e) {
      Alert.alert('Création du PDF impossible', String((e && e.message) || e));
    }
    setBusy('');
  }

  if (!db) return null;
  const items = db.items.filter((i) => i.theme === cur).sort((a, b) => a.ts - b.ts);
  const size = (width - 24 - 12) / 3;
  const selItem = db.items.find((i) => i.id === sel);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: 12, gap: 10 }}>
          <Text style={{ color: C.ink, fontSize: 24, fontWeight: '700' }}>Photothèque</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {db.themes.map((t) => {
              const on = t.id === cur;
              return (
                <Pressable key={t.id} onPress={() => setCur(t.id)} style={{ backgroundColor: on ? C.acc : C.card, borderColor: on ? C.acc : C.line, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
                  <Text style={{ color: on ? C.on : C.ink, fontWeight: on ? '700' : '500' }}>
                    {t.name} ({db.items.filter((i) => i.theme === t.id).length})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={name} onChangeText={setName} onSubmitEditing={addTheme} placeholder="Nouveau thème" placeholderTextColor={C.mut} maxLength={40} style={[fld(C), { flex: 1, paddingVertical: 10 }]} />
            <Btn C={C} t="Ajouter" onPress={addTheme} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn flex pri C={C} t="📷 Photo" onPress={() => shoot('photo')} />
            <Btn flex C={C} t="🎥 Vidéo" onPress={() => shoot('video')} />
            <Btn flex C={C} t="📝 Texte" onPress={addNote} />
            <Btn flex C={C} t="🖼️ Galerie" onPress={pick} />
          </View>
          <Btn C={C} pri={qcOn} t={qcOn ? '⚡ Raccourci actif — touche pour l’arrêter' : '⚡ Activer le raccourci flottant'} onPress={toggleQuick} />
          {busy ? <Text style={{ color: C.acc, textAlign: 'center' }}>{busy}</Text> : null}
        </View>
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 30, gap: 6 }}
          columnWrapperStyle={{ gap: 6 }}
          ListEmptyComponent={<Text style={{ color: C.mut, textAlign: 'center', padding: 24 }}>Ce thème est vide. Prends une photo, écris une note ou importe des images depuis ta galerie.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSel(item.id)} style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', backgroundColor: C.line }}>
              {item.type === 'video' ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 28, color: C.ink }}>▶</Text>
                  <Text style={{ color: C.mut }}>Vidéo</Text>
                </View>
              ) : item.type === 'text' ? (
                <View style={{ flex: 1, padding: 6, backgroundColor: C.card }}>
                  <Text numberOfLines={6} style={{ color: C.ink, fontSize: 12 }}>{item.txt}</Text>
                </View>
              ) : (
                <Image source={{ uri: uriOf(item) }} style={{ flex: 1 }} />
              )}
              {item.cap ? (
                <Text numberOfLines={1} style={{ position: 'absolute', left: 4, right: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 6, paddingHorizontal: 6, fontSize: 12 }}>
                  {item.cap}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListFooterComponent={
            <View style={{ gap: 8, marginTop: 16 }}>
              {items.some((i) => i.type !== 'video') ? <Btn C={C} t="Exporter le thème en PDF" onPress={exportPdf} /> : null}
              <Btn C={C} bad t="Supprimer ce thème" onPress={removeTheme} />
            </View>
          }
        />
        {selItem ? (
          <Viewer key={selItem.id + (selItem.file || selItem.uri || '')} C={C} it={selItem} themes={db.themes} busy={busy} onClose={() => setSel(null)} onPatch={onPatch} onEdit={onEdit} onMove={onMove} onDelete={() => onDelete(selItem)} />
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
