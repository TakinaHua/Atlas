import importlib.util, unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('builder', Path(__file__).with_name('build-walking-graph.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
class ImportTests(unittest.TestCase):
    def graph(self, tags='', node_tags=''):
        return builder.build(f'<osm><node id="1" lat="40.44" lon="-80.005">{node_tags}</node><node id="2" lat="40.441" lon="-80.005"/><way id="5"><nd ref="1"/><nd ref="2"/><tag k="highway" v="footway"/>{tags}</way></osm>'.encode())
    def test_direction_and_access(self):
        self.assertEqual(len(self.graph()['edges']),2)
        self.assertEqual(len(self.graph('<tag k="oneway" v="yes"/>')['edges']),2)
        self.assertEqual([e[:2] for e in self.graph('<tag k="oneway:foot" v="yes"/>')['edges']],[['1','2']])
        self.assertEqual([e[:2] for e in self.graph('<tag k="oneway:foot" v="-1"/>')['edges']],[['2','1']])
        for tags in ['<tag k="foot" v="no"/>','<tag k="access" v="private"/>','<tag k="access:conditional" v="no @ night"/>','<tag k="area" v="yes"/>']:
            self.assertEqual(self.graph(tags)['edges'],[])
        self.assertEqual(self.graph(node_tags='<tag k="barrier" v="gate"/>')['edges'],[])
        self.assertEqual(len(self.graph('<tag k="access" v="private"/><tag k="foot" v="yes"/>')['edges']),2)
if __name__=='__main__': unittest.main()
