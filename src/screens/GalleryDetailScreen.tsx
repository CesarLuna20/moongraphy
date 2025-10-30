import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";
import { Gallery, GalleryStatus, UploadableGalleryAsset } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "GalleryDetail">;

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
const statusAccent: Record<GalleryStatus, string> = {
  pending: colors.muted,
  review: colors.accent,
  delivered: colors.primary,
  received: colors.success
};

const ensureAbsoluteUrl = (url: string) => {
  if (!url) {
    return url;
  }
  return url.startsWith("http") ? url : `${API_URL}${url}`;
};

const formatDate = (value?: string) => {
  if (!value) {
    return "-";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const GalleryDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { galleryId } = route.params;
  const user = useAppStore((state) => state.user);
  const galleries = useAppStore((state) => state.galleries);
  const selectedGallery = useAppStore((state) => state.selectedGallery);
  const galleryUploadStates = useAppStore((state) => state.galleryUploadStates);
  const fetchGallery = useAppStore((state) => state.fetchGallery);
  const uploadGalleryAssets = useAppStore((state) => state.uploadGalleryAssets);
  const updateGalleryStatus = useAppStore((state) => state.updateGalleryStatus);
  const confirmGalleryDelivery = useAppStore((state) => state.confirmGalleryDelivery);
  const clearGalleryUploadState = useAppStore((state) => state.clearGalleryUploadState);

  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  const isPhotographer = user?.role === "photographer" || user?.role === "photographer-admin";
  const isClient = user?.role === "client";

  const gallery = useMemo(() => {
    return galleries.find((item) => item.id === galleryId) ?? (selectedGallery?.id === galleryId ? selectedGallery : undefined);
  }, [galleries, galleryId, selectedGallery]);

  useFocusEffect(
    useCallback(() => {
      fetchGallery(galleryId).catch((error) => {
        console.error("[gallery-detail] Error inicial cargando galeria", error);
        Alert.alert("Error", "No fue posible cargar la galeria. Intenta de nuevo.");
      });
    }, [fetchGallery, galleryId])
  );

  const uploadState = galleryUploadStates[galleryId];

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchGallery(galleryId);
    } catch (error) {
      console.error("[gallery-detail] Error actualizando galeria", error);
      Alert.alert("Error", "No fue posible actualizar la galeria.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchGallery, galleryId]);

  const handleTogglePhoto = (photoId: string) => {
    setSelectedPhotos((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]
    );
  };

  const handlePickImages = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_MIME_TYPES,
        multiple: true,
        copyToCacheDirectory: false
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const invalid = result.assets.filter(
        (asset) => asset.mimeType && !ACCEPTED_MIME_TYPES.includes(asset.mimeType.toLowerCase())
      );
      if (invalid.length > 0) {
        Alert.alert("Formato no permitido", "Solo se aceptan imagenes JPG o PNG.");
        return;
      }
      const normalized: UploadableGalleryAsset[] = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.name ?? `foto-${index + 1}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
        size: asset.size
      }));
      const response = await uploadGalleryAssets(galleryId, normalized, (progress) => {
        // deliberately left blank, la store ya sincroniza el estado
      });
      if (!response.success) {
        Alert.alert("Error", response.error ?? "No se pudieron subir las imagenes.");
        return;
      }
      clearGalleryUploadState(galleryId);
      Alert.alert("Exito", `${normalized.length} archivo(s) subido(s) correctamente.`);
    } catch (error) {
      console.error("[gallery-detail] Error seleccionando imagenes", error);
      Alert.alert("Error", "No fue posible seleccionar las imagenes.");
    }
  };

  const handleSetStatus = async (status: "review" | "delivered") => {
    if (!gallery) {
      return;
    }
    if (status === "delivered" && gallery.photoCount === 0) {
      Alert.alert("Accion no permitida", "Agrega al menos una foto antes de marcar como entregada.");
      return;
    }
    const result = await updateGalleryStatus(galleryId, status);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudo actualizar el estado.");
      return;
    }
    if (status === "delivered") {
      Alert.alert(
        "Galeria entregada",
        result.notificationSent
          ? "El cliente recibira una notificacion para revisar el material."
          : "Estado actualizado. Revisa la conexion para notificar al cliente si es necesario."
      );
    }
  };

  const handleConfirmDelivery = async () => {
    if (!gallery) {
      return;
    }
    if (gallery.status !== "delivered") {
      Alert.alert("En revision", "El material aun no esta disponible. Espera a que el fotografo lo entregue.");
      return;
    }
    const result = await confirmGalleryDelivery(galleryId);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudo confirmar la recepcion.");
      return;
    }
    Alert.alert("Gracias", "Se registro la confirmacion de entrega.");
  };

  const downloadPhotoToCache = async (photo: Gallery["photos"][number]) => {
    const extension = photo.originalName?.split(".").pop() ?? "jpg";
    const fileName = `${photo.id}.${extension}`;
    const rawBaseDir =
      ((FileSystem as any).cacheDirectory as string | undefined) ??
      ((FileSystem as any).documentDirectory as string | undefined);
    if (!rawBaseDir) {
      throw new Error("Sin directorio temporal disponible");
    }
    const normalizedBase = rawBaseDir.endsWith("/") ? rawBaseDir.slice(0, -1) : rawBaseDir;
    const directory = `${normalizedBase}/moongraphy`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});
    const target = `${directory}/${fileName}`;
    const source = ensureAbsoluteUrl(photo.url);
    const result = await FileSystem.downloadAsync(source, target);
    return result.uri;
  };

  const handleDownloadPhoto = async (photo: Gallery["photos"][number]) => {
    try {
      setDownloading(true);
      const localUri = await downloadPhotoToCache(photo);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      } else {
        Alert.alert("Descarga completada", `Archivo guardado en: ${localUri}`);
      }
    } catch (error) {
      console.error("[gallery-detail] Error descargando imagen", error);
      Alert.alert("Error", "No se pudo descargar la imagen.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSelected = async () => {
    if (!gallery) {
      return;
    }
    if (selectedPhotos.length === 0) {
      Alert.alert("Selecciona imagenes", "Marca al menos una foto para descargar.");
      return;
    }
    try {
      setDownloading(true);
      const targets: string[] = [];
      for (const photoId of selectedPhotos) {
        const photo = gallery.photos.find((item) => item.id === photoId);
        if (!photo) {
          continue;
        }
        const uri = await downloadPhotoToCache(photo);
        targets.push(uri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
      if (targets.length > 0 && !(await Sharing.isAvailableAsync())) {
        Alert.alert("Descarga completada", `Archivos guardados temporalmente:\n${targets.join("\n")}`);
      }
      setSelectedPhotos([]);
    } catch (error) {
      console.error("[gallery-detail] Error en descarga multiple", error);
      Alert.alert("Error", "No fue posible completar la descarga.");
    } finally {
      setDownloading(false);
    }
  };

  const canEditMetadata = isPhotographer && (gallery?.photoCount ?? 0) === 0;

  const handleEditGallery = () => {
    navigation.navigate("GalleryEditor", { mode: "edit", galleryId });
  };

  const uploadingProgress = uploadState?.progress ?? 0;
  const isUploading = uploadState?.uploading ?? false;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            progressBackgroundColor={colors.card}
            colors={[colors.primary, colors.accent]}
          />
        }
      >
        {!gallery ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Cargando galeria...</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
                <Text style={styles.backText}>◀ Volver</Text>
              </Pressable>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{gallery.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusAccent[gallery.status] ?? colors.border }
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{gallery.statusLabel ?? gallery.status}</Text>
                </View>
              </View>
              {gallery.description ? (
                <Text style={styles.description}>{gallery.description}</Text>
              ) : (
                <Text style={styles.descriptionMuted}>Sin descripcion</Text>
              )}
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Sesion</Text>
                  <Text style={styles.infoValue}>
                    {gallery.session
                      ? `${gallery.session.type} • ${new Date(gallery.session.start).toLocaleString()}`
                      : "Sin asignar"}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Cliente</Text>
                  <Text style={styles.infoValue}>{gallery.client?.name ?? "Sin asignar"}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Actualizacion</Text>
                  <Text style={styles.infoValue}>{formatDate(gallery.updatedAt)}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Fotos</Text>
                  <Text style={styles.infoValue}>{gallery.photoCount}</Text>
                </View>
              </View>
              {canEditMetadata ? (
                <Pressable style={styles.editButton} onPress={handleEditGallery}>
                  <Text style={styles.editButtonText}>Editar datos</Text>
                </Pressable>
              ) : null}
            </View>

            {isPhotographer ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Gestionar estado</Text>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      {
                        borderColor: colors.accent,
                        backgroundColor: gallery.status === "review" ? "rgba(155,108,255,0.12)" : colors.card
                      }
                    ]}
                    onPress={() => handleSetStatus("review")}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: gallery.status === "review" ? colors.accent : colors.muted }
                      ]}
                    >
                      Marcar en revision
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionButton,
                      {
                        borderColor: colors.primary,
                        backgroundColor: gallery.status === "delivered" ? "rgba(108,160,255,0.12)" : colors.card
                      }
                    ]}
                    onPress={() => handleSetStatus("delivered")}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: gallery.status === "delivered" ? colors.primary : colors.muted }
                      ]}
                    >
                      Marcar entregada
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {isPhotographer ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Subir fotos</Text>
                <Text style={styles.sectionSubtitle}>
                  Selecciona imagenes JPG o PNG. Puedes reintentar si la conexion se interrumpe.
                </Text>
                <Pressable style={styles.uploadButton} onPress={handlePickImages}>
                  <Text style={styles.uploadButtonText}>Seleccionar imagenes</Text>
                </Pressable>
                {isUploading ? (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressValue, { width: `${Math.max(5, uploadingProgress * 100)}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{Math.round(uploadingProgress * 100)}%</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Galeria</Text>
                {selectedPhotos.length > 0 ? (
                  <Pressable style={styles.clearSelection} onPress={() => setSelectedPhotos([])}>
                    <Text style={styles.clearSelectionText}>Cancelar seleccion</Text>
                  </Pressable>
                ) : null}
              </View>
              {gallery.photos.length === 0 ? (
                <Text style={styles.emptyGalleryText}>
                  {isPhotographer
                    ? "Aun no has cargado fotos en esta galeria."
                    : "El fotografo aun no ha compartido fotos en esta galeria."}
                </Text>
              ) : (
                <View style={styles.photoGrid}>
                  {gallery.photos.map((photo) => {
                    const isSelected = selectedPhotos.includes(photo.id);
                    return (
                      <View key={photo.id} style={[styles.photoCard, isSelected && styles.photoCardSelected]}>
                        <Pressable
                          onPress={() => handleDownloadPhoto(photo)}
                          onLongPress={() => handleTogglePhoto(photo.id)}
                        >
                          <Image
                            source={{ uri: ensureAbsoluteUrl(photo.url) }}
                            style={styles.photo}
                            resizeMode="cover"
                          />
                        </Pressable>
                        <View style={styles.photoFooter}>
                          <Pressable onPress={() => handleTogglePhoto(photo.id)}>
                            <Text style={[styles.photoAction, isSelected && styles.photoActionSelected]}>
                              {isSelected ? "Seleccionada" : "Seleccionar"}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => handleDownloadPhoto(photo)}>
                            <Text style={styles.photoDownload}>Descargar</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {selectedPhotos.length > 1 ? (
              <Pressable
                style={[styles.downloadSelectedButton, downloading && styles.downloadSelectedDisabled]}
                onPress={handleDownloadSelected}
                disabled={downloading}
              >
                <Text style={styles.downloadSelectedText}>
                  {downloading ? "Descargando..." : `Descargar ${selectedPhotos.length} fotos`}
                </Text>
              </Pressable>
            ) : null}

            {isClient ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recepcion</Text>
                <Text style={styles.sectionSubtitle}>
                  Confirma cuando hayas descargado correctamente tu material.
                </Text>
                <Pressable
                  style={[
                    styles.confirmButton,
                    (gallery.status !== "delivered" || downloading) && styles.confirmButtonDisabled
                  ]}
                  onPress={handleConfirmDelivery}
                  disabled={gallery.status !== "delivered" || downloading}
                >
                  <Text style={styles.confirmButtonText}>
                    {gallery.status === "received" ? "Entrega confirmada" : "Confirmar recepcion"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {gallery.history?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Historial</Text>
                {gallery.history.map((entry) => (
                  <View key={`${entry.timestamp}-${entry.type}`} style={styles.historyItem}>
                    <Text style={styles.historyTimestamp}>{formatDate(entry.timestamp)}</Text>
                    <Text style={styles.historyText}>{entry.summary}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scrollContent: {
    padding: spacing(2),
    paddingBottom: spacing(6)
  },
  loadingBlock: {
    marginTop: spacing(6),
    alignItems: "center",
    gap: spacing(1.5)
  },
  loadingText: {
    color: colors.muted
  },
  header: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing(2),
    marginBottom: spacing(2),
    gap: spacing(1)
  },
  backLink: {
    marginBottom: spacing(1)
  },
  backText: {
    color: colors.muted,
    fontSize: 13
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1)
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    flex: 1
  },
  statusBadge: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.5)
  },
  statusBadgeText: {
    color: "#0D0F14",
    fontWeight: "700",
    fontSize: 12
  },
  description: {
    color: colors.text
  },
  descriptionMuted: {
    color: colors.muted
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1.5)
  },
  infoItem: {
    minWidth: "48%"
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: spacing(0.25)
  },
  infoValue: {
    color: colors.text,
    fontSize: 13
  },
  editButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: "rgba(155,108,255,0.12)"
  },
  editButtonText: {
    color: colors.accent,
    fontWeight: "600"
  },
  section: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing(2),
    marginBottom: spacing(2)
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing(1)
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: spacing(1)
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing(1)
  },
  actionButton: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing(1),
    alignItems: "center",
    backgroundColor: colors.card
  },
  actionButtonText: {
    color: colors.muted,
    fontWeight: "600"
  },
  uploadButton: {
    borderRadius: radii.md,
    paddingVertical: spacing(1.25),
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: "rgba(155,108,255,0.12)",
    marginTop: spacing(1)
  },
  uploadButtonText: {
    color: colors.accent,
    fontWeight: "700"
  },
  progressContainer: {
    marginTop: spacing(1),
    gap: spacing(0.75)
  },
  progressBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border
  },
  progressValue: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 999
  },
  progressText: {
    color: colors.muted,
    fontSize: 11
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1)
  },
  photoCard: {
    width: "48%",
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#131722"
  },
  photoCardSelected: {
    borderColor: colors.primary
  },
  photo: {
    width: "100%",
    aspectRatio: 1
  },
  photoFooter: {
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.75),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  photoAction: {
    color: colors.muted,
    fontSize: 12
  },
  photoActionSelected: {
    color: colors.primary,
    fontWeight: "700"
  },
  photoDownload: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600"
  },
  emptyGalleryText: {
    color: colors.muted,
    fontSize: 13
  },
  downloadSelectedButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing(1.25),
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(108,160,255,0.12)",
    marginBottom: spacing(2)
  },
  downloadSelectedDisabled: {
    opacity: 0.5
  },
  downloadSelectedText: {
    color: colors.primary,
    fontWeight: "700"
  },
  confirmButton: {
    alignItems: "center",
    borderRadius: radii.md,
    paddingVertical: spacing(1.25),
    backgroundColor: colors.success
  },
  confirmButtonDisabled: {
    opacity: 0.4
  },
  confirmButtonText: {
    color: "#0D0F14",
    fontWeight: "700"
  },
  historyItem: {
    paddingVertical: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  historyTimestamp: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: spacing(0.25)
  },
  historyText: {
    color: colors.text,
    fontSize: 13
  },
  clearSelection: {
    paddingVertical: spacing(0.5)
  },
  clearSelectionText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600"
  }
});

export default GalleryDetailScreen;
