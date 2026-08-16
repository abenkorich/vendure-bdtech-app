import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {SafeAreaView} from 'react-native-safe-area-context';

/** Placeholder screen. Replaced by the Account feature work. */
export default function AccountScreen() {
    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.container}>
                <Text style={styles.title}>Account</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create(theme => ({
    safe: {flex: 1, backgroundColor: theme.colors.background},
    container: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    title: {...theme.typography.title, color: theme.colors.text},
}));
