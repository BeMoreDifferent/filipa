import React, { useState, useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
} from 'react-native';
import { useChatStore } from '@/store/chatStore';
import * as SystemStore from '@/store/ModelStore';
import { AiProviderConfig, AiModel } from '@/constants/AiProviderModels';
import { useTheme } from '@/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, defaultStyles } from '@/constants/Styles';
import { Colors } from '@/constants/Colors';
import { t } from '@/config/i18n';
import {
  BottomSheetModal,
  BottomSheetSectionList,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';

// Define types
type ApiProviderId = AiProviderConfig['id'];

interface ModelSection {
  title: string;
  data: (AiModel & { providerId: ApiProviderId; providerName: string })[];
  providerId?: ApiProviderId; // Optional: useful for 'All Models' section headers
}

const ModelSelector = forwardRef(function ModelSelector(_props, ref) {
  const { colors, theme } = useTheme();
  const { selectedModelId, setSelectedModelId } = useChatStore();
  const [apiKeyStatus, setApiKeyStatus] = useState<Record<ApiProviderId, boolean | undefined>>({ openai: undefined, groq: undefined, gemini: undefined });
  const [allProviderConfigs] = useState<ReturnType<typeof SystemStore.getAllProviderConfigs>>(SystemStore.getAllProviderConfigs());
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([]);

  const loadKeyStatusAndFavorites = useCallback(async () => {
    const status: Record<ApiProviderId, boolean | undefined> = {
      openai: undefined,
      groq: undefined,
      gemini: undefined,
    };
    const providerIds = Object.keys(allProviderConfigs) as ApiProviderId[];
    for (const providerId of providerIds) {
      try {
        const key = await SystemStore.getApiKey(providerId);
        status[providerId] = !!key;
      } catch (error) {
        console.error(`Error checking API key for ${providerId}:`, error);
        status[providerId] = false;
      }
    }
    setApiKeyStatus(status);

    try {
      const favs = await SystemStore.getFavoriteModelIds();
      setFavoriteModelIds(favs);
    } catch (error) {
      console.error('Error loading favorite models:', error);
      setFavoriteModelIds([]);
    }
    return status;
  }, [allProviderConfigs]);

  useEffect(() => {
    const initialize = async () => {
      const currentApiKeyStatus = await loadKeyStatusAndFavorites();
      const lastModelId = await SystemStore.getLastSelectedModelId();

      if (lastModelId && SystemStore.getModelById(lastModelId)) {
        const providerConfig = SystemStore.getProviderConfigForModel(lastModelId);
        if (providerConfig && currentApiKeyStatus[providerConfig.id]) {
          setSelectedModelId(lastModelId);
        } else {
          const initialDefault = SystemStore.getInitialDefaultModelId(currentApiKeyStatus);
          if (initialDefault) {
            setSelectedModelId(initialDefault);
            await SystemStore.setLastSelectedModelId(initialDefault);
          } else {
            setSelectedModelId('');
          }
        }
      } else {
        const initialDefault = SystemStore.getInitialDefaultModelId(currentApiKeyStatus);
        if (initialDefault) {
          setSelectedModelId(initialDefault);
          await SystemStore.setLastSelectedModelId(initialDefault);
        } else {
          setSelectedModelId('');
        }
      }
    };
    initialize();
  }, [loadKeyStatusAndFavorites, setSelectedModelId]);

  // Bottom Sheet Ref and Snap Points
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['60%', '85%'], []);

  // Expose present() to parent via ref
  useImperativeHandle(ref, () => ({
    present: async () => {
      await loadKeyStatusAndFavorites();
      bottomSheetModalRef.current?.present();
    }
  }));

  const handlePresentModalPress = useCallback(async () => {
    await loadKeyStatusAndFavorites();
    bottomSheetModalRef.current?.present();
  }, [loadKeyStatusAndFavorites]);

  const handleDismissModal = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  const selectedModelDetails = useMemo(() => SystemStore.getModelById(selectedModelId), [selectedModelId]);

  const handleSelectModel = async (modelId: string) => {
    setSelectedModelId(modelId);
    try {
      await SystemStore.setLastSelectedModelId(modelId);
    } catch (error) {
      console.error('Failed to set last selected model ID:', error);
    }
    handleDismissModal();
  };

  const handleToggleFavorite = async (modelId: string) => {
    const newFavorites = favoriteModelIds.includes(modelId)
      ? favoriteModelIds.filter((id) => id !== modelId)
      : [...favoriteModelIds, modelId];
    setFavoriteModelIds(newFavorites);
    try {
      await SystemStore.setFavoriteModelIds(newFavorites);
    } catch (error) {
      console.error('Failed to save favorite models:', error);
      setFavoriteModelIds(favoriteModelIds);
    }
  };

  const sections = useMemo(() => {
    const favModels: (AiModel & { providerId: ApiProviderId; providerName: string })[] = [];
    favoriteModelIds.forEach(id => {
      const model = SystemStore.getModelById(id);
      const provider = model ? SystemStore.getProviderConfigForModel(id) : undefined;
      if (model && provider && apiKeyStatus[provider.id]) {
        favModels.push({ ...model, providerId: provider.id, providerName: provider.name });
      }
    });

    const modelSections: ModelSection[] = [];
    if (favModels.length > 0) {
      modelSections.push({ title: t('modelSelector.favorites', 'Favorites'), data: favModels });
    }

    Object.values(allProviderConfigs).forEach((provider) => {
      if (apiKeyStatus[provider.id]) {
        const providerModels = provider.models.map(m => ({ ...m, providerId: provider.id, providerName: provider.name }));
        modelSections.push({
          title: provider.name,
          data: providerModels,
          providerId: provider.id
        });
      }
    });
    return modelSections;
  }, [allProviderConfigs, favoriteModelIds, apiKeyStatus]);

  // Custom Backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  const renderSectionHeader = ({ section }: { section: ModelSection }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  );

  const renderModelItem = ({ item }: { item: AiModel & { providerId: ApiProviderId; providerName: string } }) => {
    const isSelected = selectedModelId === item.id;
    const isFavorite = favoriteModelIds.includes(item.id);
    const labelColorToUse = Colors.grey[500];

    return (
      <TouchableOpacity
        style={styles.modelRow}
        onPress={() => handleSelectModel(item.id)}
      >
        <View style={styles.modelDetailsContainer}>
          <Text style={[styles.modelNameText, isSelected && styles.modelNameTextSelected]} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </Text>
          {(item.pricing || item.label) && (
            <View style={styles.metaRow}>
              {item.pricing && (
                <View style={styles.priceInfoContainer}>
                  <Ionicons name="arrow-down-circle-outline" size={14} color={Colors.grey[500]} style={styles.priceIcon} />
                  <Text style={styles.priceText}>{item.pricing.input.toFixed(2)}</Text>
                  <Ionicons name="arrow-up-circle-outline" size={14} color={Colors.grey[500]} style={styles.priceIcon} />
                  <Text style={styles.priceText}>{item.pricing.output.toFixed(2)}</Text>
                </View>
              )}
              {item.label && (
                <View style={[styles.modelLabelTag, { borderColor: labelColorToUse }]}>
                  <Text style={[styles.modelLabelTagText, { color: labelColorToUse }]}>{item.label}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.rightIconsContainer}>
          {isSelected && (
            <Ionicons
              name="checkmark"
              size={24}
              color={Colors.primary[500]}
              style={styles.selectionCheckmarkIcon}
            />
          )}
          <TouchableOpacity onPress={() => handleToggleFavorite(item.id)} style={styles.favoriteStarIconContainer}>
            <Ionicons 
              name="star-outline" 
              size={24} 
              color={isFavorite ? Colors.primary[500] : Colors.grey[300]}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      marginRight: Spacing.sm,
    },
    selectedModelText: {
      ...defaultStyles.textCaption,
      color: Colors.grey[700],
      marginRight: Spacing.xs,
      maxWidth: 100,
    },
    bottomSheetContentContainer: {
      paddingBottom: Spacing.lg,
      flexGrow: 1,
    },
    modalTitle: {
      ...defaultStyles.textSubheading,
      color: Colors.grey[800],
      fontSize: 14,
      textTransform: 'uppercase',
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs / 2,
      textAlign: 'center',
    },
    pricingLegendText: {
      ...defaultStyles.textCaption,
      color: Colors.grey[500],
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    sectionHeader: {
      ...defaultStyles.textSubheading,
      color: Colors.grey[800],
      backgroundColor: Colors.grey[200],
      fontSize: 14,
      textTransform: 'uppercase',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.grey[300],
      fontWeight: '600',
    },
    modelRow: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.grey[300],
    },
    modelDetailsContainer: {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    rightIconsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectionCheckmarkIcon: {
      marginRight: Spacing.sm,
    },
    favoriteStarIconContainer: {
      padding: Spacing.xs,
    },
    modelNameText: {
      ...defaultStyles.textBody,
      color: Colors.grey[700],
    },
    modelNameTextSelected: {
      fontWeight: 'bold',
      color: Colors.grey[900],
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs / 2,
    },
    priceInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: Spacing.sm,
    },
    priceIcon: {
      marginRight: Spacing.xs / 2,
    },
    priceText: {
      ...defaultStyles.textCaption,
      color: Colors.grey[500],
      marginRight: Spacing.sm,
    },
    modelLabelTag: {
      borderWidth: 1,
      borderRadius: BorderRadius.xs,
      paddingHorizontal: Spacing.xs,
      paddingVertical: 1,
    },
    modelLabelTagText: {
      ...defaultStyles.textCaption,
      fontSize: 10,
      fontWeight: 'bold',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    noKeysText: {
      ...defaultStyles.textBody,
      color: Colors.grey[600],
      textAlign: 'center',
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: Colors.grey[400] }}
      backgroundStyle={{ backgroundColor: Colors.grey[100] }}
    >
      <Text style={styles.modalTitle}>{t('modelSelector.title', 'Select AI Model')}</Text>
      <Text style={styles.pricingLegendText}>{t('modelSelector.pricingUnit', 'per 1M tokens')}</Text>
      {sections.length > 0 ? (
        <BottomSheetSectionList
          sections={sections}
          keyExtractor={(item, index) => item.id + index}
          renderItem={renderModelItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.bottomSheetContentContainer}
          stickySectionHeadersEnabled={true}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.noKeysText}>
            {t('modelSelector.noKeysSet', 'Please set an API key in Settings to select models.')}
          </Text>
        </View>
      )}
    </BottomSheetModal>
  );
});

export default ModelSelector; 