import React, {useEffect, useMemo, useState} from 'react';
import {useNetInfo} from '@react-native-community/netinfo';
import {DrawerActions, useNavigation} from '@react-navigation/native';
import {BottomSheet, Box} from 'components';
import {DevSettings} from 'react-native';
import {checkNotifications, requestNotifications} from 'react-native-permissions';
import {
  SystemStatus,
  useExposureNotificationListener,
  useExposureStatus,
  useStartExposureNotificationService,
  useSystemStatus,
} from 'services/ExposureNotificationService';
import {useMaxContentWidth} from 'shared/useMaxContentWidth';
import {Theme} from 'shared/theme';
import {useStorage} from 'services/StorageService';
import {getRegionCase} from 'shared/RegionLogic';

import {RegionCase} from '../../shared/Region';

import {BluetoothDisabledView} from './views/BluetoothDisabledView';
import {CollapsedOverlayView} from './views/CollapsedOverlayView';
import {DiagnosedShareView} from './views/DiagnosedShareView';
import {DiagnosedView} from './views/DiagnosedView';
import {ExposureNotificationsDisabledView} from './views/ExposureNotificationsDisabledView';
import {ExposureView} from './views/ExposureView';
import {NoExposureUncoveredRegionView} from './views/NoExposureUncoveredRegionView';
import {NoExposureCoveredRegionView} from './views/NoExposureCoveredRegionView';
import {NoExposureNoRegionView} from './views/NoExposureNoRegionView';
import {NetworkDisabledView} from './views/NetworkDisabledView';
import {OverlayView} from './views/OverlayView';

type NotificationPermission = 'denied' | 'granted' | 'unavailable' | 'blocked';
type BackgroundColor = keyof Theme['colors'];

interface ContentProps {
  setBackgroundColor: (color: string) => void;
}

const strToBackgroundColor = (backgroundColor: string): BackgroundColor => {
  const color: BackgroundColor = backgroundColor as BackgroundColor;
  return color;
};

const useNotificationPermissionStatus = (): [string, () => void] => {
  const [status, setStatus] = useState<NotificationPermission>('granted');

  checkNotifications()
    .then(({status}) => {
      setStatus(status);
    })
    .catch(error => {
      console.log(error);
      setStatus('unavailable');
    });

  const request = () => {
    requestNotifications(['alert'])
      .then(({status}) => {
        setStatus(status);
      })
      .catch(error => {
        console.log(error);
      });
  };

  return [status === 'granted' ? status : 'denied', request];
};

const Content = ({setBackgroundColor}: ContentProps) => {
  const {region} = useStorage();
  const regionCase = getRegionCase(region);
  const [exposureStatus, updateExposureStatus] = useExposureStatus();
  const [systemStatus, updateSystemStatus] = useSystemStatus();
  const startExposureNotificationService = useStartExposureNotificationService();

  useEffect(() => {
    startExposureNotificationService();
  }, [startExposureNotificationService]);

  const network = useNetInfo();
  setBackgroundColor('mainBackground');

  const getNoExposureView = (_regionCase: RegionCase) => {
    switch (_regionCase) {
      case 'noRegionSet':
        return <NoExposureNoRegionView />;
      case 'regionCovered':
        return <NoExposureCoveredRegionView />;
      case 'regionNotCovered':
        return <NoExposureUncoveredRegionView />;
    }
  };

  switch (exposureStatus.type) {
    case 'exposed':
      return <ExposureView />;
    case 'diagnosed':
      return exposureStatus.needsSubmission ? <DiagnosedShareView /> : <DiagnosedView />;
    case 'monitoring':
    default:
      if (!network.isConnected && network.type !== 'unknown') return <NetworkDisabledView />;
      switch (systemStatus) {
        case SystemStatus.Disabled:
        case SystemStatus.Restricted:
          return <ExposureNotificationsDisabledView />;
        case SystemStatus.BluetoothOff:
          return <BluetoothDisabledView />;
        case SystemStatus.Active:
        case SystemStatus.Unknown:
          return getNoExposureView(regionCase);
      }
  }
};

export const HomeScreen = () => {
  const navigation = useNavigation();
  useEffect(() => {
    if (__DEV__) {
      DevSettings.addMenuItem('Show Test Menu', () => {
        navigation.dispatch(DrawerActions.openDrawer());
      });
    }
  }, [navigation]);

  const exposureNotificationListener = useExposureNotificationListener();
  useEffect(() => {
    return exposureNotificationListener();
  }, [exposureNotificationListener]);

  const [systemStatus] = useSystemStatus();
  const [notificationStatus, turnNotificationsOn] = useNotificationPermissionStatus();
  const showNotificationWarning = notificationStatus === 'denied';

  const collapsedContent = useMemo(
    () => (
      <CollapsedOverlayView
        status={systemStatus}
        notificationWarning={showNotificationWarning}
        turnNotificationsOn={turnNotificationsOn}
      />
    ),
    [showNotificationWarning, systemStatus, turnNotificationsOn],
  );

  const maxWidth = useMaxContentWidth();
  const [backgroundColor, setBackgroundColor] = useState<string>('mainBackground');

  return (
    <Box flex={1} alignItems="center" backgroundColor={strToBackgroundColor(backgroundColor)}>
      <Box flex={1} maxWidth={maxWidth} paddingTop="m">
        <Content setBackgroundColor={setBackgroundColor} />
      </Box>
      <BottomSheet
        // need to change the key here so bottom sheet is rerendered. This is because the snap points change.
        key={showNotificationWarning ? 'notifications-disabled' : 'notifications-enabled'}
        collapsedContent={collapsedContent}
        extraContent={showNotificationWarning}
      >
        <OverlayView
          status={systemStatus}
          notificationWarning={showNotificationWarning}
          turnNotificationsOn={turnNotificationsOn}
          maxWidth={maxWidth}
        />
      </BottomSheet>
    </Box>
  );
};
