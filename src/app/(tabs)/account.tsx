import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Screen} from '@/components/ui/screen';

/** Placeholder screen. Replaced by the Account feature work. */
export default function AccountScreen() {
    return (
        <Screen>
            <View style={styles.container}>
                <Text style={styles.title}>Account</Text>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    container: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    title: {...theme.typography.title, color: theme.colors.text},
}));
