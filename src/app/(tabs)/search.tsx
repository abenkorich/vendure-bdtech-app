import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Screen} from '@/components/ui/screen';

/** Placeholder screen. Replaced by the Search feature work. */
export default function SearchScreen() {
    return (
        <Screen>
            <View style={styles.container}>
                <Text style={styles.title}>Search</Text>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    container: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    title: {...theme.typography.title, color: theme.colors.text},
}));
